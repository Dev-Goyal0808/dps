"""Coordinates validation, crypto, QIM, TCP transfer, and result storage."""

from __future__ import annotations

import concurrent.futures
import hmac
import uuid

from PIL import Image

from app.config import Settings
from app.crypto.aead import decrypt_serialized
from app.crypto.identity import IdentityKeyPair, TrustedPeerStore
from app.networking.tcp_client import TcpClient
from app.networking.tcp_server import TcpTransferServer
from app.services.metrics_service import (
    compare_images,
    comparison_metrics,
    envelope_metrics,
    sender_metrics,
)
from app.services.result_store import ResultStore
from app.services.session_manager import SessionManager, SessionPhase
from app.steganography.capacity import require_capacity
from app.steganography.image_io import LoadedImage, load_image
from app.steganography.qim import extract_payload
from app.utils.errors import BackendError, ErrorCode
from app.utils.timing import PhaseTimer


class WorkflowService:
    def __init__(
        self,
        settings: Settings,
        sessions: SessionManager,
        results: ResultStore,
        identity: IdentityKeyPair,
        trusted_peers: TrustedPeerStore,
    ) -> None:
        self.settings = settings
        self.sessions = sessions
        self.results = results
        self.identity = identity
        self.trusted_peers = trusted_peers
        self.server: TcpTransferServer | None = None
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="stegocrypt-workflow")
        self._original_images: dict[str, Image.Image] = {}
        self._expected_messages: dict[str, str] = {}

    def set_server(self, server: TcpTransferServer) -> None:
        self.server = server

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=True)

    def validate_send_input(self, message: str, loaded: LoadedImage) -> None:
        try:
            message_bytes = message.encode("utf-8")
        except UnicodeEncodeError as exc:
            raise BackendError(ErrorCode.INVALID_REQUEST, "The message must be valid UTF-8.") from exc
        if len(message_bytes) > self.settings.max_message_bytes:
            raise BackendError(
                ErrorCode.MESSAGE_TOO_LARGE,
                "The message is too large.",
                status_code=413,
                details={"max_bytes": self.settings.max_message_bytes},
            )
        # SCEP consists of a 23-byte header, nonce, GCM tag, and plaintext.
        require_capacity(
            loaded.image.width,
            loaded.image.height,
            len(message_bytes) + 51,
            quantizer_id=1,
        )

    def start_send(self, session_id: str, message: str, loaded: LoadedImage) -> uuid.UUID:
        session = self.sessions.get_status(session_id)
        if session.status != SessionPhase.CONNECTED:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The session is not ready for a message.", status_code=409)
        self.validate_send_input(message, loaded)
        message_id = uuid.uuid4()
        self.results.create(session_id, message_id)
        self._original_images[str(message_id)] = loaded.image.copy()
        # Kept only to verify the receiver's round trip; never used as a result.
        self._expected_messages[str(message_id)] = message
        self.sessions.update_phase(session_id, SessionPhase.VALIDATING, message_id=str(message_id))
        self._executor.submit(self._run_send, session_id, message_id, message, loaded.image.copy())
        return message_id

    def _run_send(self, session_id: str, message_id: uuid.UUID, message: str, cover: Image.Image) -> None:
        if self.server is None or not self.server.is_ready:
            self._fail(session_id, message_id, ErrorCode.RECEIVER_UNAVAILABLE, "The receiver is unavailable.")
            return

        def on_phase(phase: str, value: float) -> None:
            if phase in {"encrypting", "embedding", "transferring"}:
                self.sessions.update_phase(session_id, phase, message_id=str(message_id))

        client = TcpClient(
            host=self.settings.tcp_host,
            port=self.server.port,
            identity=self.identity,
            expected_peer=self.identity.public_bytes,
            max_frame_bytes=self.settings.max_frame_bytes,
            chunk_size=self.settings.chunk_size,
            max_image_bytes=self.settings.max_stego_image_bytes,
            connect_timeout=self.settings.connect_timeout_seconds,
            frame_timeout=self.settings.frame_timeout_seconds,
            handshake_timeout=self.settings.handshake_timeout_seconds,
            transfer_timeout=self.settings.transfer_timeout_seconds,
            qim_delta=self.settings.qim_delta,
            on_phase=on_phase,
        )
        plaintext_bytes = len(message.encode("utf-8"))

        def on_embedded(payload: bytes, capacity_bytes: int, timings: dict[str, float]) -> None:
            # Written before the image is sent, so these measurements are already
            # in the record by the time the receiver reports COMPLETED.
            self.results.update_metrics(
                str(message_id),
                sender_metrics(
                    payload=payload,
                    plaintext_bytes=plaintext_bytes,
                    capacity_bytes=capacity_bytes,
                    timings=timings,
                ),
            )

        try:
            client.send(
                session_id=session_id,
                message_id=message_id,
                plaintext=message,
                cover_image=cover,
                on_embedded=on_embedded,
            )
            # Transmission time and image throughput are published by the receiver
            # from its own clock, so they always share the basis of the receiver
            # workflow time and payload throughput shown beside them.
        except BackendError as exc:
            self._fail(session_id, message_id, exc.code, exc.message)
        except Exception:
            self._fail(session_id, message_id, ErrorCode.TRANSFER_FAILED, "The image transfer failed.")
        finally:
            self._original_images.pop(str(message_id), None)
            self._expected_messages.pop(str(message_id), None)

    def handle_received(
        self,
        session_id: str,
        message_id: uuid.UUID,
        image_bytes: bytes,
        session_key: bytes,
        transfer_seconds: float,
    ) -> None:
        message_key = str(message_id)
        try:
            self.sessions.update_phase(session_id, SessionPhase.EXTRACTING, message_id=message_key)
            timer = PhaseTimer()
            timer.start("extraction")
            loaded = load_image(
                image_bytes,
                max_bytes=self.settings.max_stego_image_bytes,
                max_width=self.settings.max_image_width,
                max_height=self.settings.max_image_height,
            )
            payload = extract_payload(
                loaded.image,
                delta=self.settings.qim_delta,
                max_payload_bytes=self.settings.max_message_bytes + 1024,
            )
            extraction_seconds = timer.stop("extraction")
            quality_metrics: dict[str, float | int] = {
                "payload_bytes": len(payload),
                "capacity_bytes": (loaded.image.width * loaded.image.height * 3) // 8,
            }
            original = self._original_images.get(message_key)
            if original is not None:
                comparison = compare_images(original, loaded.image)
                if comparison is not None:
                    # The receiver publishes the same comparison the sender will
                    # report, so a completed result is never partially filled.
                    quality_metrics.update(
                        comparison_metrics(
                            comparison,
                            payload_bytes=len(payload),
                            pixels=loaded.image.width * loaded.image.height,
                        )
                    )
            capacity_bytes = int(quality_metrics["capacity_bytes"])
            payload_bytes = int(quality_metrics["payload_bytes"])
            quality_metrics["capacity_utilization"] = payload_bytes / capacity_bytes if capacity_bytes else 0.0
            quality_metrics["remaining_bytes"] = max(capacity_bytes - payload_bytes, 0)
            self.sessions.update_phase(session_id, SessionPhase.VERIFYING, message_id=message_key)
            timer.start("decryption")
            plaintext_bytes = decrypt_serialized(
                session_key,
                payload,
                session_id=session_id,
                expected_message_id=message_id,
                max_bytes=self.settings.max_message_bytes + 1024,
            )
            plaintext = plaintext_bytes.decode("utf-8")
            decryption_seconds = timer.stop("decryption")
            expected = self._expected_messages.pop(message_key, None)
            plaintext_match = expected is not None and hmac.compare_digest(
                plaintext.encode("utf-8"), expected.encode("utf-8")
            )
            workflow_seconds = transfer_seconds + extraction_seconds + decryption_seconds
            # Publish the recovery metrics before marking the record complete. This
            # makes a completed result self-consistent for clients that poll as soon
            # as the receiver transitions to COMPLETED; sender-side image-quality
            # metrics are merged into the same record shortly afterward.
            self.results.update_metrics(
                message_key,
                {
                    **quality_metrics,
                    **envelope_metrics(payload, plaintext_bytes=len(plaintext.encode("utf-8"))),
                    "extraction_time_ms": extraction_seconds * 1000,
                    "decryption_time_ms": decryption_seconds * 1000,
                    "transmission_time_ms": transfer_seconds * 1000,
                    "throughput_bytes_per_second": len(image_bytes) / transfer_seconds if transfer_seconds > 0 else 0.0,
                    "workflow_time_ms": workflow_seconds * 1000,
                    "payload_throughput_bytes_per_second": (
                        payload_bytes / workflow_seconds if workflow_seconds > 0 else 0.0
                    ),
                    "plaintext_match": plaintext_match,
                    "recovery_status": "verified",
                },
            )
            # The result store is the only place where verified plaintext is retained.
            self.results.mark_verified(message_key, plaintext, image_bytes)
            self.sessions.update_phase(
                session_id,
                SessionPhase.COMPLETED,
                message_id=message_key,
                progress=1.0,
                bytes_sent=len(image_bytes),
                bytes_total=len(image_bytes),
            )
        except BackendError as exc:
            self.results.mark_rejected(message_key, exc.code, self._safe_rejection_message(exc.code))
            self.sessions.update_phase(
                session_id,
                SessionPhase.REJECTED,
                message_id=message_key,
                error={"code": exc.code, "message": self._safe_rejection_message(exc.code)},
            )
        except (UnicodeDecodeError, ValueError):
            code = ErrorCode.AUTHENTICATION_FAILED
            message = self._safe_rejection_message(code)
            self.results.mark_rejected(message_key, code, message)
            self.sessions.update_phase(session_id, SessionPhase.REJECTED, message_id=message_key, error={"code": code, "message": message})

    def _fail(self, session_id: str, message_id: uuid.UUID, code: str, message: str) -> None:
        try:
            self.results.mark_failed(message_id.__str__(), code, self._safe_failure_message(code, message))
            self.sessions.update_phase(
                session_id,
                SessionPhase.FAILED,
                message_id=str(message_id),
                error={"code": code, "message": self._safe_failure_message(code, message)},
            )
        except BackendError:
            pass

    @staticmethod
    def _safe_rejection_message(code: str) -> str:
        if code == ErrorCode.INVALID_STEGO_PAYLOAD:
            return "The recovered payload is invalid."
        return "The recovered payload could not be authenticated."

    @staticmethod
    def _safe_failure_message(code: str, message: str) -> str:
        if code in {ErrorCode.RECEIVER_UNAVAILABLE, ErrorCode.INSUFFICIENT_CAPACITY, ErrorCode.MESSAGE_TOO_LARGE}:
            return message
        if code == ErrorCode.INVALID_IMAGE:
            return "The image could not be processed."
        return "The image transfer failed."

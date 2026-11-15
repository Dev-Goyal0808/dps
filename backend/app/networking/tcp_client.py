"""Sender-side length-framed TCP transfer."""

from __future__ import annotations

import socket
import time
import uuid
from dataclasses import dataclass, field
from typing import Callable

from PIL import Image

from app.crypto.aead import encrypt
from app.crypto.identity import IdentityKeyPair
from app.crypto.key_exchange import InitiatorHandshake
from app.networking.framing import read_frame, send_frame
from app.networking.protocol import FrameType, TransferMetadata, image_digest
from app.steganography.image_io import encode_png
from app.steganography.qim import embed_payload
from app.utils.errors import BackendError, ErrorCode
from app.utils.timing import PhaseTimer


@dataclass(frozen=True)
class ClientTransferResult:
    image_bytes: bytes
    payload_bytes: int
    capacity_bytes: int
    payload: bytes = field(default=b"", repr=False)
    timings: dict[str, float] = field(default_factory=dict)
    transfer_seconds: float = 0.0


class TcpClient:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        identity: IdentityKeyPair,
        expected_peer: bytes,
        max_frame_bytes: int,
        chunk_size: int,
        max_image_bytes: int,
        connect_timeout: float,
        frame_timeout: float,
        qim_delta: int,
        on_phase: Callable[[str, float], None] | None = None,
        on_embedded: Callable[[bytes, int, dict[str, float]], None] | None = None,
        handshake_timeout: float | None = None,
        transfer_timeout: float | None = None,
    ) -> None:
        self.host = host
        self.port = port
        self.identity = identity
        self.expected_peer = expected_peer
        self.max_frame_bytes = max_frame_bytes
        self.chunk_size = min(chunk_size, max_frame_bytes - 32)
        self.max_image_bytes = max_image_bytes
        self.connect_timeout = connect_timeout
        self.frame_timeout = frame_timeout
        self.handshake_timeout = handshake_timeout or frame_timeout
        self.transfer_timeout = transfer_timeout or frame_timeout
        self.qim_delta = qim_delta
        self.on_phase = on_phase
        self.on_embedded = on_embedded

    def _phase(self, name: str, elapsed: float) -> None:
        if self.on_phase is not None:
            self.on_phase(name, elapsed)

    def send(
        self,
        *,
        session_id: str,
        message_id: uuid.UUID,
        plaintext: str,
        cover_image: Image.Image,
        on_embedded: Callable[[bytes, int, dict[str, float]], None] | None = None,
    ) -> ClientTransferResult:
        timer = PhaseTimer()
        timer.start("connect")
        try:
            sock = socket.create_connection((self.host, self.port), timeout=self.connect_timeout)
        except (OSError, TimeoutError) as exc:
            raise BackendError(
                ErrorCode.RECEIVER_UNAVAILABLE,
                "The receiver is unavailable.",
                status_code=503,
            ) from exc
        connect_seconds = timer.stop("connect")
        self._phase("connected", connect_seconds)
        sock.settimeout(self.handshake_timeout)
        try:
            handshake = InitiatorHandshake(self.identity, self.expected_peer, session_id)
            timer.start("handshake")
            send_frame(sock, FrameType.CLIENT_HELLO, handshake.client_hello(), max_frame_bytes=self.max_frame_bytes)
            server_hello = read_frame(sock, max_frame_bytes=self.max_frame_bytes)
            if server_hello.frame_type is not FrameType.SERVER_HELLO:
                raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The receiver handshake is invalid.")
            client_finished = handshake.process_server_hello(server_hello.body)
            server_finished = read_frame(sock, max_frame_bytes=self.max_frame_bytes)
            if server_finished.frame_type is not FrameType.HANDSHAKE_FINISHED:
                raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The receiver handshake is incomplete.")
            handshake.verify_server_finished(server_finished.body)
            send_frame(sock, FrameType.HANDSHAKE_FINISHED, client_finished, max_frame_bytes=self.max_frame_bytes)
            if handshake.result is None:
                raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The receiver handshake is incomplete.")
            timer.stop("handshake")
            self._phase("connected", timer.durations["handshake"])
            sock.settimeout(self.frame_timeout)

            timer.start("encryption")
            encrypted = encrypt(
                handshake.result.session_key,
                plaintext,
                session_id=session_id,
                message_id=message_id,
            )
            payload = encrypted.serialize()
            encryption_seconds = timer.stop("encryption")
            self._phase("encrypting", encryption_seconds)

            timer.start("embedding")
            stego_image = embed_payload(cover_image, payload, delta=self.qim_delta)
            image_bytes = encode_png(stego_image, max_bytes=self.max_image_bytes)
            embedding_seconds = timer.stop("embedding")
            self._phase("embedding", embedding_seconds)

            timings = {
                "connection_seconds": connect_seconds,
                "handshake_seconds": timer.durations["handshake"],
                "encryption_seconds": encryption_seconds,
                "embedding_seconds": embedding_seconds,
            }
            publish_embedded = on_embedded or self.on_embedded
            if publish_embedded is not None:
                # Publish the sender-side measurements before the transfer starts,
                # so a result read as soon as the receiver completes already has
                # every timer that was measured instead of a placeholder zero.
                publish_embedded(
                    payload,
                    (cover_image.width * cover_image.height * 3) // 8,
                    timings,
                )

            chunk_count = (len(image_bytes) + self.chunk_size - 1) // self.chunk_size
            metadata = TransferMetadata(
                message_id,
                len(image_bytes),
                image_digest(image_bytes),
                self.chunk_size,
                chunk_count,
            )
            timer.start("transfer")
            transfer_deadline = time.monotonic() + self.transfer_timeout
            send_frame(sock, FrameType.TRANSFER_METADATA, metadata.encode(), max_frame_bytes=self.max_frame_bytes)
            for sequence in range(chunk_count):
                remaining = transfer_deadline - time.monotonic()
                if remaining <= 0:
                    raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer timed out.", status_code=503)
                sock.settimeout(min(self.frame_timeout, remaining))
                offset = sequence * self.chunk_size
                chunk = image_bytes[offset : offset + self.chunk_size]
                send_frame(
                    sock,
                    FrameType.IMAGE_CHUNK,
                    struct_chunk(sequence, offset, chunk),
                    max_frame_bytes=self.max_frame_bytes,
                )
                if self.on_phase is not None:
                    self.on_phase("transferring", len(chunk))
            send_frame(sock, FrameType.TRANSFER_COMPLETE, b"", max_frame_bytes=self.max_frame_bytes)
            acknowledgement = read_frame(sock, max_frame_bytes=self.max_frame_bytes)
            if acknowledgement.frame_type is FrameType.ERROR:
                raise BackendError(ErrorCode.TRANSFER_FAILED, "The receiver rejected the transfer.", status_code=503)
            if acknowledgement.frame_type is not FrameType.TRANSFER_COMPLETE:
                raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer acknowledgement is invalid.")
            transfer_seconds = timer.stop("transfer")
            return ClientTransferResult(
                image_bytes=image_bytes,
                payload_bytes=len(payload),
                capacity_bytes=(cover_image.width * cover_image.height * 3) // 8,
                payload=payload,
                timings={**timings, "transfer_seconds": transfer_seconds},
                transfer_seconds=transfer_seconds,
            )
        except BackendError:
            raise
        except (OSError, TimeoutError) as exc:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The image transfer failed.", status_code=503) from exc
        finally:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            sock.close()


def struct_chunk(sequence: int, offset: int, data: bytes) -> bytes:
    import struct

    return struct.pack(">IQI", sequence, offset, len(data)) + data

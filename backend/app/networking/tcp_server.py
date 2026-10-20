"""Receiver-side TCP listener and strict image transfer validation."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import socket
import threading
import time
import uuid
from typing import Callable

from app.crypto.identity import IdentityKeyPair, TrustedPeerStore
from app.crypto.key_exchange import ResponderHandshake
from app.networking.framing import read_frame, send_frame
from app.networking.protocol import FrameType, ImageChunk, TransferMetadata
from app.utils.errors import BackendError, ErrorCode


logger = logging.getLogger(__name__)


TransferCallback = Callable[[str, uuid.UUID, bytes, bytes, float], None]
SessionAllowed = Callable[[str], bool]


class TcpTransferServer:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        identity: IdentityKeyPair,
        trusted_peers: TrustedPeerStore,
        max_frame_bytes: int,
        max_image_bytes: int,
        max_chunk_size: int,
        frame_timeout: float,
        session_allowed: SessionAllowed,
        on_transfer: TransferCallback,
        handshake_timeout: float | None = None,
        transfer_timeout: float | None = None,
    ) -> None:
        self.host = host
        self.requested_port = port
        self.identity = identity
        self.trusted_peers = trusted_peers
        self.max_frame_bytes = max_frame_bytes
        self.max_image_bytes = max_image_bytes
        self.max_chunk_size = min(max_chunk_size, max_frame_bytes - 32)
        self.frame_timeout = frame_timeout
        self.handshake_timeout = handshake_timeout or frame_timeout
        self.transfer_timeout = transfer_timeout or frame_timeout
        self.session_allowed = session_allowed
        self.on_transfer = on_transfer
        self._listener: socket.socket | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._ready = threading.Event()

    @property
    def port(self) -> int:
        if self._listener is None:
            return self.requested_port
        return int(self._listener.getsockname()[1])

    @property
    def is_ready(self) -> bool:
        return self._ready.is_set() and self._listener is not None

    def start(self) -> None:
        if self.is_ready:
            return
        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            listener.bind((self.host, self.requested_port))
            listener.listen(8)
            listener.settimeout(0.2)
        except OSError:
            listener.close()
            raise
        self._listener = listener
        self._stop.clear()
        self._thread = threading.Thread(target=self._accept_loop, name="stegocrypt-tcp", daemon=True)
        self._thread.start()
        self._ready.set()

    def stop(self) -> None:
        self._stop.set()
        listener = self._listener
        self._listener = None
        self._ready.clear()
        if listener is not None:
            try:
                listener.close()
            except OSError:
                pass
        if self._thread is not None:
            self._thread.join(timeout=1.0)
        self._thread = None

    def _accept_loop(self) -> None:
        listener = self._listener
        if listener is None:
            return
        while not self._stop.is_set():
            try:
                connection, _ = listener.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            worker = threading.Thread(target=self._handle_connection, args=(connection,), daemon=True)
            worker.start()

    def _handle_connection(self, connection: socket.socket) -> None:
        connection.settimeout(self.handshake_timeout)
        try:
            self._handle_connection_inner(connection)
        except BackendError as exc:
            self._send_error(connection, exc.code)
            logger.info("TCP transfer rejected: %s", exc.code)
        except (OSError, TimeoutError):
            logger.info("TCP transfer disconnected")
        except Exception:
            logger.error("TCP transfer failed with an unexpected internal error")
        finally:
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            connection.close()

    def _handle_connection_inner(self, connection: socket.socket) -> None:
        frame = read_frame(connection, max_frame_bytes=self.max_frame_bytes)
        if frame.frame_type is not FrameType.CLIENT_HELLO:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake message is invalid.")
        session_id = _session_id_from_hello(frame.body)
        if not self.session_allowed(session_id):
            raise BackendError(ErrorCode.SESSION_NOT_FOUND, "The session was not found.", status_code=404)
        responder = ResponderHandshake(self.identity, self.trusted_peers, session_id)
        server_hello, server_finished = responder.process_client_hello(frame.body)
        send_frame(connection, FrameType.SERVER_HELLO, server_hello, max_frame_bytes=self.max_frame_bytes)
        send_frame(connection, FrameType.HANDSHAKE_FINISHED, server_finished, max_frame_bytes=self.max_frame_bytes)
        client_finished = read_frame(connection, max_frame_bytes=self.max_frame_bytes)
        if client_finished.frame_type is not FrameType.HANDSHAKE_FINISHED:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake confirmation is invalid.")
        responder.verify_client_finished(client_finished.body)
        if responder.result is None:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake did not produce a session key.")

        transfer_started = time.perf_counter()
        transfer_deadline = time.monotonic() + self.transfer_timeout
        connection.settimeout(min(self.frame_timeout, self.transfer_timeout))
        metadata_frame = read_frame(connection, max_frame_bytes=self.max_frame_bytes)
        if metadata_frame.frame_type is not FrameType.TRANSFER_METADATA:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer metadata is missing.")
        metadata = TransferMetadata.decode(
            metadata_frame.body,
            max_image_bytes=self.max_image_bytes,
            max_chunk_count=self.max_image_bytes,
        )
        if metadata.chunk_size > self.max_chunk_size:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer chunk is too large.", status_code=413)

        image = bytearray(metadata.image_length)
        expected_sequence = 0
        expected_offset = 0
        for _ in range(metadata.chunk_count):
            remaining = transfer_deadline - time.monotonic()
            if remaining <= 0:
                raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer timed out.", status_code=503)
            connection.settimeout(min(self.frame_timeout, remaining))
            chunk_frame = read_frame(connection, max_frame_bytes=self.max_frame_bytes)
            if chunk_frame.frame_type is not FrameType.IMAGE_CHUNK:
                raise BackendError(ErrorCode.TRANSFER_FAILED, "The image chunks are incomplete.")
            chunk = ImageChunk.decode(chunk_frame.body)
            if chunk.sequence_number != expected_sequence or chunk.offset != expected_offset:
                raise BackendError(ErrorCode.TRANSFER_FAILED, "The image chunks are out of order.")
            if not chunk.data or len(chunk.data) > metadata.chunk_size:
                raise BackendError(ErrorCode.TRANSFER_FAILED, "The image chunk size is invalid.")
            if expected_offset + len(chunk.data) > metadata.image_length:
                raise BackendError(ErrorCode.TRANSFER_FAILED, "The image chunks exceed the image length.")
            image[expected_offset : expected_offset + len(chunk.data)] = chunk.data
            expected_sequence += 1
            expected_offset += len(chunk.data)
        complete = read_frame(connection, max_frame_bytes=self.max_frame_bytes)
        if complete.frame_type is not FrameType.TRANSFER_COMPLETE:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer completion is missing.")
        if expected_offset != metadata.image_length or not _digest_matches(bytes(image), metadata.image_sha256):
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transferred image digest is invalid.")
        self.on_transfer(
            session_id,
            metadata.message_id,
            bytes(image),
            responder.result.session_key,
            time.perf_counter() - transfer_started,
        )
        send_frame(connection, FrameType.TRANSFER_COMPLETE, b"", max_frame_bytes=self.max_frame_bytes)

    def _send_error(self, connection: socket.socket, code: str) -> None:
        try:
            send_frame(
                connection,
                FrameType.ERROR,
                json.dumps({"code": code}, separators=(",", ":")).encode("utf-8"),
                max_frame_bytes=self.max_frame_bytes,
            )
        except (OSError, BackendError):
            pass


def _session_id_from_hello(body: bytes) -> str:
    try:
        value = json.loads(body.decode("utf-8"))
        session_id = value["session_id"]
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake message is malformed.") from exc
    if not isinstance(session_id, str) or not session_id:
        raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake session is invalid.")
    return session_id


def _digest_matches(image: bytes, expected: bytes) -> bool:
    return hmac.compare_digest(hashlib.sha256(image).digest(), expected)

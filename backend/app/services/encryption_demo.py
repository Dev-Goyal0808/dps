"""In-memory authenticated encryption demonstration service."""

from __future__ import annotations

import base64
import uuid
from dataclasses import dataclass

from app.config import Settings
from app.crypto.aead import decrypt_serialized, encrypt
from app.crypto.identity import IdentityKeyPair, TrustedPeerStore
from app.crypto.key_exchange import InitiatorHandshake, ResponderHandshake
from app.crypto.payload import PAYLOAD_VERSION
from app.utils.errors import BackendError, CryptoError, ErrorCode


def _base64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


@dataclass(frozen=True)
class EncryptionDemoResult:
    message_id: str
    recovery_status: str
    recovered_message: str
    ciphertext: str
    serialized_payload: str
    nonce: str
    sender_fingerprint: str
    receiver_fingerprint: str
    transcript_hash: str
    algorithm_details: dict[str, str]
    payload_bytes: int


class EncryptionDemoService:
    """Run one complete sender/receiver crypto flow without transport or steganography."""

    def __init__(self, settings: Settings, receiver_identity: IdentityKeyPair) -> None:
        self.max_message_bytes = settings.max_message_bytes
        self.receiver_identity = receiver_identity

    def encrypt_and_recover(self, message: str) -> EncryptionDemoResult:
        message_bytes = self._validate_message(message)
        session_id = str(uuid.uuid4())
        message_id = uuid.uuid4()
        sender_identity = IdentityKeyPair.generate()

        initiator = InitiatorHandshake(sender_identity, self.receiver_identity.public_bytes, session_id)
        responder = ResponderHandshake(
            self.receiver_identity,
            TrustedPeerStore({sender_identity.public_bytes}),
            session_id,
        )
        client_hello = initiator.client_hello()
        server_hello, receiver_finished = responder.process_client_hello(client_hello)
        sender_finished = initiator.process_server_hello(server_hello)
        initiator.verify_server_finished(receiver_finished)
        responder.verify_client_finished(sender_finished)

        if initiator.result is None or responder.result is None:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The in-memory handshake did not complete.")

        payload = encrypt(
            initiator.result.session_key,
            message_bytes,
            session_id=session_id,
            message_id=message_id,
        )
        serialized_payload = payload.serialize()
        recovered_bytes = decrypt_serialized(
            responder.result.session_key,
            serialized_payload,
            session_id=session_id,
            expected_message_id=message_id,
            max_bytes=self.max_message_bytes + 1024,
        )
        try:
            recovered_message = recovered_bytes.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise CryptoError(
                ErrorCode.AUTHENTICATION_FAILED,
                "The recovered payload could not be authenticated.",
            ) from exc
        if recovered_message != message:
            raise CryptoError(
                ErrorCode.AUTHENTICATION_FAILED,
                "The recovered payload could not be authenticated.",
            )

        return EncryptionDemoResult(
            message_id=str(message_id),
            recovery_status="verified",
            recovered_message=recovered_message,
            ciphertext=_base64(payload.ciphertext),
            serialized_payload=_base64(serialized_payload),
            nonce=_base64(payload.nonce),
            sender_fingerprint=sender_identity.fingerprint,
            receiver_fingerprint=self.receiver_identity.fingerprint,
            transcript_hash=initiator.result.transcript_hash.hex(),
            algorithm_details={
                "identity": "Ed25519",
                "key_exchange": "X25519",
                "key_derivation": "HKDF-SHA256",
                "encryption": "AES-256-GCM",
                "payload_format": f"EncryptedPayload v{PAYLOAD_VERSION}",
            },
            payload_bytes=len(serialized_payload),
        )

    def _validate_message(self, message: str) -> bytes:
        if not isinstance(message, str) or not message:
            raise BackendError(
                ErrorCode.INVALID_REQUEST,
                "The message must not be empty.",
                status_code=422,
            )
        try:
            message_bytes = message.encode("utf-8")
        except UnicodeEncodeError as exc:
            raise BackendError(
                ErrorCode.INVALID_REQUEST,
                "The message must be valid UTF-8.",
                status_code=422,
            ) from exc
        if len(message_bytes) > self.max_message_bytes:
            raise BackendError(
                ErrorCode.MESSAGE_TOO_LARGE,
                "The message is too large.",
                status_code=413,
                details={"max_bytes": self.max_message_bytes},
            )
        return message_bytes

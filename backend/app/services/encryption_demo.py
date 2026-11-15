"""In-memory authenticated encryption demonstration service."""

from __future__ import annotations

import base64
import binascii
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from app.config import Settings
from app.crypto.aead import decrypt_serialized, encrypt
from app.crypto.identity import IdentityKeyPair, TrustedPeerStore
from app.crypto.key_exchange import InitiatorHandshake, ResponderHandshake
from app.crypto.payload import PAYLOAD_VERSION
from app.utils.errors import BackendError, CryptoError, ErrorCode
from app.utils.security import constant_time_equal, hash_token, random_token, token_matches


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


@dataclass(frozen=True)
class EncryptionChannelResult:
    session_id: str
    sender_token: str
    receiver_token: str
    expires_at: datetime
    sender_fingerprint: str
    receiver_fingerprint: str
    transcript_hash: str
    algorithm_details: dict[str, str]


@dataclass(frozen=True)
class EncryptedMessageResult:
    session_id: str
    message_id: str
    status: str
    ciphertext: str
    serialized_payload: str
    nonce: str
    sender_fingerprint: str
    receiver_fingerprint: str
    transcript_hash: str
    algorithm_details: dict[str, str]
    payload_bytes: int


@dataclass(frozen=True)
class DecryptedMessageResult:
    session_id: str
    message_id: str
    recovery_status: str
    plaintext: str


@dataclass
class _StoredEnvelope:
    serialized_payload: bytes = field(repr=False)


@dataclass
class _EncryptionChannel:
    session_id: str
    sender_token_hash: bytes
    receiver_token_hash: bytes
    expires_at: datetime
    sender_session_key: bytes = field(repr=False)
    receiver_session_key: bytes = field(repr=False)
    sender_fingerprint: str
    receiver_fingerprint: str
    transcript_hash: str
    messages: dict[str, _StoredEnvelope] = field(default_factory=dict, repr=False)


class EncryptionDemoService:
    """Run one complete sender/receiver crypto flow without transport or steganography."""

    def __init__(self, settings: Settings, receiver_identity: IdentityKeyPair) -> None:
        self.max_message_bytes = settings.max_message_bytes
        self.session_lifetime_seconds = settings.session_lifetime_seconds
        self.receiver_identity = receiver_identity
        self._channels: dict[str, _EncryptionChannel] = {}
        self._lock = threading.RLock()

    def create_channel(self) -> EncryptionChannelResult:
        """Create an authenticated in-memory channel and return its one-time credentials."""

        session_id = str(uuid.uuid4())
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

        sender_token = random_token()
        receiver_token = random_token()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self.session_lifetime_seconds)
        channel = _EncryptionChannel(
            session_id=session_id,
            sender_token_hash=hash_token(sender_token),
            receiver_token_hash=hash_token(receiver_token),
            expires_at=expires_at,
            sender_session_key=initiator.result.session_key,
            receiver_session_key=responder.result.session_key,
            sender_fingerprint=sender_identity.fingerprint,
            receiver_fingerprint=self.receiver_identity.fingerprint,
            transcript_hash=initiator.result.transcript_hash.hex(),
        )
        with self._lock:
            self._channels[session_id] = channel
        return EncryptionChannelResult(
            session_id=session_id,
            sender_token=sender_token,
            receiver_token=receiver_token,
            expires_at=expires_at,
            sender_fingerprint=channel.sender_fingerprint,
            receiver_fingerprint=channel.receiver_fingerprint,
            transcript_hash=channel.transcript_hash,
            algorithm_details=self._algorithm_details(),
        )

    def send_message(self, session_id: str, token: str, message: str) -> EncryptedMessageResult:
        """Encrypt and retain a message for the receiver without returning plaintext."""

        with self._lock:
            channel = self._authorize_locked(session_id, token, "sender")
            message_bytes = self._validate_message(message)
            message_id = uuid.uuid4()
            payload = encrypt(
                channel.sender_session_key,
                message_bytes,
                session_id=session_id,
                message_id=message_id,
            )
            serialized_payload = payload.serialize()
            channel.messages[str(message_id)] = _StoredEnvelope(serialized_payload=serialized_payload)
            return EncryptedMessageResult(
                session_id=session_id,
                message_id=str(message_id),
                status="stored",
                ciphertext=_base64(payload.ciphertext),
                serialized_payload=_base64(serialized_payload),
                nonce=_base64(payload.nonce),
                sender_fingerprint=channel.sender_fingerprint,
                receiver_fingerprint=channel.receiver_fingerprint,
                transcript_hash=channel.transcript_hash,
                algorithm_details=self._algorithm_details(),
                payload_bytes=len(serialized_payload),
            )

    def receive_message(
        self,
        session_id: str,
        token: str,
        message_id: uuid.UUID,
        serialized_payload: str | None = None,
    ) -> DecryptedMessageResult:
        """Authenticate and decrypt a stored envelope using the responder-side session key."""

        with self._lock:
            channel = self._authorize_locked(session_id, token, "receiver")
            stored = channel.messages.get(str(message_id))
            if stored is None:
                raise BackendError(ErrorCode.MESSAGE_NOT_FOUND, "The encrypted message was not found.", status_code=404)

            if serialized_payload is not None:
                supplied = self._decode_envelope(serialized_payload)
                if not constant_time_equal(supplied, stored.serialized_payload):
                    raise CryptoError(
                        ErrorCode.AUTHENTICATION_FAILED,
                        "The recovered payload could not be authenticated.",
                    )

            try:
                recovered_bytes = decrypt_serialized(
                    channel.receiver_session_key,
                    stored.serialized_payload,
                    session_id=session_id,
                    expected_message_id=message_id,
                    max_bytes=self.max_message_bytes + 1024,
                )
            except BackendError as exc:
                raise CryptoError(
                    ErrorCode.AUTHENTICATION_FAILED,
                    "The recovered payload could not be authenticated.",
                ) from exc
            try:
                plaintext = recovered_bytes.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise CryptoError(
                    ErrorCode.AUTHENTICATION_FAILED,
                    "The recovered payload could not be authenticated.",
                ) from exc
            return DecryptedMessageResult(
                session_id=session_id,
                message_id=str(message_id),
                recovery_status="verified",
                plaintext=plaintext,
            )

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
            algorithm_details=self._algorithm_details(),
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

    def _authorize_locked(self, session_id: str, token: str, role: str) -> _EncryptionChannel:
        try:
            channel = self._channels[session_id]
        except KeyError as exc:
            raise BackendError(ErrorCode.SESSION_NOT_FOUND, "The session was not found.", status_code=404) from exc
        if datetime.now(timezone.utc) > channel.expires_at:
            raise BackendError(ErrorCode.SESSION_EXPIRED, "The session has expired.", status_code=409)

        expected_hash = channel.sender_token_hash if role == "sender" else channel.receiver_token_hash
        if token_matches(token, expected_hash):
            return channel
        opposite_hash = channel.receiver_token_hash if role == "sender" else channel.sender_token_hash
        if token_matches(token, opposite_hash):
            raise BackendError(ErrorCode.FORBIDDEN, "The bearer token has the wrong role.", status_code=403)
        raise BackendError(ErrorCode.UNAUTHORIZED, "The bearer token is invalid.", status_code=401)

    @staticmethod
    def _algorithm_details() -> dict[str, str]:
        return {
            "identity": "Ed25519",
            "key_exchange": "X25519",
            "key_derivation": "HKDF-SHA256",
            "encryption": "AES-256-GCM",
            "payload_format": f"EncryptedPayload v{PAYLOAD_VERSION}",
        }

    @staticmethod
    def _decode_envelope(value: str) -> bytes:
        if not isinstance(value, str):
            raise CryptoError(ErrorCode.AUTHENTICATION_FAILED, "The recovered payload could not be authenticated.")
        try:
            encoded = value.encode("ascii")
            decoded = base64.b64decode(encoded, validate=True)
        except (UnicodeEncodeError, binascii.Error, ValueError) as exc:
            raise CryptoError(
                ErrorCode.AUTHENTICATION_FAILED,
                "The recovered payload could not be authenticated.",
            ) from exc
        if _base64(decoded) != value:
            raise CryptoError(ErrorCode.AUTHENTICATION_FAILED, "The recovered payload could not be authenticated.")
        return decoded

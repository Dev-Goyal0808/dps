"""AES-256-GCM encryption and authenticated decryption."""

from __future__ import annotations

import hmac
import secrets
import uuid

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.crypto.payload import EncryptedPayload, NONCE_LENGTH, PAYLOAD_VERSION
from app.utils.errors import BackendError, CryptoError, ErrorCode


def associated_data(session_id: str, message_id: uuid.UUID, *, version: int = PAYLOAD_VERSION) -> bytes:
    if not isinstance(session_id, str) or not isinstance(message_id, uuid.UUID):
        raise ValueError("associated data requires a session string and UUID message ID")
    if type(version) is not int or version != PAYLOAD_VERSION:
        raise ValueError("the payload version is unsupported")
    return f"StegoCrypt/v{version}|{session_id}|{message_id}|AES-256-GCM".encode("utf-8")


def encrypt(
    key: bytes,
    plaintext: str | bytes,
    *,
    session_id: str,
    message_id: uuid.UUID,
    version: int = 1,
) -> EncryptedPayload:
    if not isinstance(key, bytes) or len(key) != 32:
        raise ValueError("AES-256-GCM requires a 32-byte key")
    if not isinstance(plaintext, (str, bytes)):
        raise TypeError("plaintext must be text or bytes")
    raw = plaintext.encode("utf-8") if isinstance(plaintext, str) else plaintext
    nonce = secrets.token_bytes(NONCE_LENGTH)
    ciphertext = AESGCM(key).encrypt(nonce, raw, associated_data(session_id, message_id, version=version))
    return EncryptedPayload(message_id, nonce, ciphertext, version=version)


def decrypt(
    key: bytes,
    payload: EncryptedPayload,
    *,
    session_id: str,
    expected_message_id: uuid.UUID | None = None,
) -> bytes:
    if not isinstance(key, bytes) or len(key) != 32:
        raise ValueError("AES-256-GCM requires a 32-byte key")
    if not isinstance(payload, EncryptedPayload):
        raise CryptoError(ErrorCode.AUTHENTICATION_FAILED, "The recovered payload could not be authenticated.")
    if not isinstance(session_id, str):
        raise CryptoError(ErrorCode.AUTHENTICATION_FAILED, "The recovered payload could not be authenticated.")
    try:
        payload.validate()
    except (TypeError, ValueError) as exc:
        raise CryptoError(ErrorCode.AUTHENTICATION_FAILED, "The recovered payload could not be authenticated.") from exc
    if expected_message_id is not None and not isinstance(expected_message_id, uuid.UUID):
        raise CryptoError(ErrorCode.AUTHENTICATION_FAILED, "The recovered payload could not be authenticated.")
    if expected_message_id is not None and not hmac.compare_digest(
        payload.message_id.bytes, expected_message_id.bytes
    ):
        raise CryptoError(ErrorCode.AUTHENTICATION_FAILED, "The recovered payload could not be authenticated.")
    try:
        return AESGCM(key).decrypt(
            payload.nonce,
            payload.ciphertext,
            associated_data(session_id, payload.message_id, version=payload.version),
        )
    except (InvalidTag, TypeError, ValueError) as exc:
        raise CryptoError(ErrorCode.AUTHENTICATION_FAILED, "The recovered payload could not be authenticated.") from exc


def decrypt_serialized(
    key: bytes,
    serialized: bytes,
    *,
    session_id: str,
    expected_message_id: uuid.UUID | None = None,
    max_bytes: int = 256 * 1024 + 1024,
) -> bytes:
    try:
        payload = EncryptedPayload.parse(serialized, max_bytes=max_bytes)
    except BackendError:
        raise
    return decrypt(key, payload, session_id=session_id, expected_message_id=expected_message_id)

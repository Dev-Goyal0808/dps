from __future__ import annotations

import uuid

import pytest

from app.crypto.aead import associated_data, decrypt, encrypt
from app.crypto.payload import EncryptedPayload
from app.utils.errors import CryptoError


def test_aes_gcm_round_trip_supports_empty_and_unicode_messages() -> None:
    key = b"k" * 32
    session_id = str(uuid.uuid4())
    message_id = uuid.uuid4()
    for message in ("", "秘密 🌍"):
        payload = encrypt(key, message, session_id=session_id, message_id=message_id)
        assert decrypt(key, payload, session_id=session_id, expected_message_id=message_id) == message.encode()


def test_aes_gcm_rejects_modified_ciphertext_and_associated_data() -> None:
    key = b"k" * 32
    session_id = str(uuid.uuid4())
    message_id = uuid.uuid4()
    payload = encrypt(key, "authenticated", session_id=session_id, message_id=message_id)
    tampered = EncryptedPayload(payload.message_id, payload.nonce, bytes([payload.ciphertext[0] ^ 1]) + payload.ciphertext[1:])
    with pytest.raises(CryptoError):
        decrypt(key, tampered, session_id=session_id, expected_message_id=message_id)
    with pytest.raises(CryptoError):
        decrypt(key, payload, session_id=str(uuid.uuid4()), expected_message_id=message_id)
    assert associated_data(session_id, message_id) != associated_data(str(uuid.uuid4()), message_id)


def test_aes_gcm_generates_fresh_nonce() -> None:
    key = b"k" * 32
    session_id = str(uuid.uuid4())
    message_id = uuid.uuid4()
    first = encrypt(key, "same", session_id=session_id, message_id=message_id)
    second = encrypt(key, "same", session_id=session_id, message_id=message_id)
    assert first.nonce != second.nonce


def test_aes_gcm_rejects_malformed_payload_and_wrong_message_id() -> None:
    key = b"k" * 32
    session_id = str(uuid.uuid4())
    message_id = uuid.uuid4()
    payload = encrypt(key, b"secret", session_id=session_id, message_id=message_id)

    malformed = EncryptedPayload(payload.message_id, b"short", payload.ciphertext)
    with pytest.raises(CryptoError):
        decrypt(key, malformed, session_id=session_id, expected_message_id=message_id)
    with pytest.raises(CryptoError):
        decrypt(key, payload, session_id=session_id, expected_message_id=uuid.uuid4())
    with pytest.raises(ValueError):
        decrypt(b"short", payload, session_id=session_id)
    with pytest.raises(ValueError):
        encrypt(key, b"secret", session_id=session_id, message_id="not-a-uuid")  # type: ignore[arg-type]
    assert payload.ciphertext.hex() not in repr(payload)

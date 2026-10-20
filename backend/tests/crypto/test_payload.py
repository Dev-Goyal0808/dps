from __future__ import annotations

import uuid

import pytest

from app.crypto.payload import EncryptedPayload
from app.utils.errors import BackendError


def test_encrypted_payload_serialization_round_trip() -> None:
    payload = EncryptedPayload(uuid.uuid4(), b"n" * 12, b"ciphertext plus tag")
    encoded = payload.serialize()
    assert EncryptedPayload.parse(encoded, max_bytes=1024) == payload


@pytest.mark.parametrize("data", [b"", b"BAD" + b"x" * 100, b"SCEP\x01\x01\x0c" + b"x" * 16])
def test_malformed_encrypted_payload_is_rejected(data: bytes) -> None:
    with pytest.raises(BackendError):
        EncryptedPayload.parse(data, max_bytes=64)


@pytest.mark.parametrize(
    "payload",
    [
        EncryptedPayload(uuid.uuid4(), b"n" * 11, b"ciphertext plus tag"),
        EncryptedPayload(uuid.uuid4(), b"n" * 12, b"too short"),
        EncryptedPayload(uuid.uuid4(), b"n" * 12, b"ciphertext plus tag", version=2),
        EncryptedPayload(uuid.uuid4(), b"n" * 12, b"ciphertext plus tag", algorithm=2),
    ],
)
def test_payload_serialization_rejects_unsupported_metadata(payload: EncryptedPayload) -> None:
    with pytest.raises(ValueError):
        payload.serialize()


def test_payload_parser_enforces_maximum_and_metadata_boundaries() -> None:
    payload = EncryptedPayload(uuid.uuid4(), b"n" * 12, b"ciphertext plus tag")
    encoded = payload.serialize()
    with pytest.raises(BackendError):
        EncryptedPayload.parse(encoded, max_bytes=len(encoded) - 1)

    wrong_algorithm = bytearray(encoded)
    wrong_algorithm[5] = 2
    with pytest.raises(BackendError):
        EncryptedPayload.parse(bytes(wrong_algorithm), max_bytes=1024)

    wrong_nonce_length = bytearray(encoded)
    wrong_nonce_length[6] = 11
    with pytest.raises(BackendError):
        EncryptedPayload.parse(bytes(wrong_nonce_length), max_bytes=1024)

from __future__ import annotations

import hashlib

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.crypto.key_derivation import FINISHED_KEY_INFO, MESSAGE_KEY_INFO, derive_key


def test_hkdf_uses_transcript_hash_salt_and_separate_contexts() -> None:
    shared_secret = bytes(range(32))
    transcript = b"canonical handshake transcript"

    expected = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=hashlib.sha256(transcript).digest(),
        info=MESSAGE_KEY_INFO,
    ).derive(shared_secret)

    assert derive_key(shared_secret, transcript) == expected
    assert derive_key(shared_secret, transcript) != derive_key(shared_secret, transcript + b"!")
    assert derive_key(shared_secret, transcript, info=FINISHED_KEY_INFO) != expected


def test_hkdf_rejects_non_x25519_key_material() -> None:
    with pytest.raises(ValueError):
        derive_key(b"short", b"transcript")

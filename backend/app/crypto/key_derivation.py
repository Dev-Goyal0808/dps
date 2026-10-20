"""HKDF-SHA256 key derivation with explicit context separation."""

from __future__ import annotations

import hashlib

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


MESSAGE_KEY_INFO = b"StegoCrypt v1 message encryption key"
FINISHED_KEY_INFO = b"StegoCrypt v1 handshake finished key"


def derive_key(shared_secret: bytes, transcript: bytes, *, info: bytes = MESSAGE_KEY_INFO) -> bytes:
    if not isinstance(shared_secret, bytes) or len(shared_secret) != 32:
        raise ValueError("the X25519 shared secret must be 32 bytes")
    if not isinstance(transcript, bytes) or not isinstance(info, bytes):
        raise TypeError("HKDF context values must be bytes")
    transcript_hash = hashlib.sha256(transcript).digest()
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=transcript_hash,
        info=info,
    ).derive(shared_secret)

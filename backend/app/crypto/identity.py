"""Ed25519 endpoint identity handling and trust lookup."""

from __future__ import annotations

import base64
import binascii
import hashlib
import stat
from dataclasses import dataclass, field
from pathlib import Path

from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from app.utils.errors import BackendError, ErrorCode


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii")


def _unb64(value: str) -> bytes:
    if not isinstance(value, str):
        raise ValueError("a base64 value must be text")
    try:
        encoded = value.encode("ascii")
        decoded = base64.b64decode(encoded, altchars=b"-_", validate=True)
    except (UnicodeEncodeError, binascii.Error, ValueError) as exc:
        raise ValueError("the base64 value is invalid") from exc
    if _b64(decoded) != value:
        raise ValueError("the base64 value is not canonical")
    return decoded


@dataclass(frozen=True)
class IdentityKeyPair:
    """A long-lived Ed25519 identity. Private key material never leaves this object."""

    private_key: Ed25519PrivateKey = field(repr=False)

    @classmethod
    def generate(cls) -> "IdentityKeyPair":
        return cls(Ed25519PrivateKey.generate())

    @classmethod
    def from_pem(cls, pem: bytes, password: bytes | None = None) -> "IdentityKeyPair":
        try:
            key = serialization.load_pem_private_key(pem, password=password)
        except (TypeError, ValueError, UnsupportedAlgorithm) as exc:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The identity key is invalid.") from exc
        if not isinstance(key, Ed25519PrivateKey):
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The identity key is not Ed25519.")
        return cls(key)

    @classmethod
    def from_private_bytes(cls, raw: bytes) -> "IdentityKeyPair":
        if not isinstance(raw, bytes) or len(raw) != 32:
            raise ValueError("an Ed25519 private key must be 32 bytes")
        return cls(Ed25519PrivateKey.from_private_bytes(raw))

    @classmethod
    def load(cls, path: Path) -> "IdentityKeyPair":
        try:
            metadata = path.stat()
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_mode & (stat.S_IRWXG | stat.S_IRWXO):
                raise BackendError(
                    ErrorCode.KEY_EXCHANGE_FAILED,
                    "The identity key permissions are too broad.",
                )
            return cls.from_pem(path.read_bytes())
        except BackendError:
            raise
        except OSError as exc:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The identity key could not be loaded.") from exc

    @property
    def public_key(self) -> Ed25519PublicKey:
        return self.private_key.public_key()

    @property
    def public_bytes(self) -> bytes:
        return self.public_key.public_bytes(
            serialization.Encoding.Raw,
            serialization.PublicFormat.Raw,
        )

    @property
    def public_key_b64(self) -> str:
        return _b64(self.public_bytes)

    @property
    def fingerprint(self) -> str:
        return f"sha256:{hashlib.sha256(self.public_bytes).hexdigest()}"

    def sign(self, data: bytes) -> bytes:
        return self.private_key.sign(data)


def public_key_from_bytes(raw: bytes) -> Ed25519PublicKey:
    if not isinstance(raw, bytes) or len(raw) != 32:
        raise ValueError("an Ed25519 public key must be 32 bytes")
    return Ed25519PublicKey.from_public_bytes(raw)


def public_key_from_b64(value: str) -> Ed25519PublicKey:
    return public_key_from_bytes(_unb64(value))


def public_key_b64(raw: bytes) -> str:
    public_key_from_bytes(raw)
    return _b64(raw)


def verify_signature(public_key: bytes, signature: bytes, data: bytes) -> None:
    try:
        public_key_from_bytes(public_key).verify(signature, data)
    except (InvalidSignature, ValueError, TypeError) as exc:
        raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "Peer signature verification failed.") from exc


class TrustedPeerStore:
    """Exact public-key trust set used by the authenticated handshake."""

    def __init__(self, public_keys: set[bytes] | None = None) -> None:
        keys = public_keys or set()
        if any(not isinstance(key, bytes) or len(key) != 32 for key in keys):
            raise ValueError("trusted peer keys must be 32-byte Ed25519 public keys")
        self._keys = frozenset(keys)

    @classmethod
    def from_b64(cls, values: tuple[str, ...] | list[str]) -> "TrustedPeerStore":
        keys: set[bytes] = set()
        for value in values:
            try:
                decoded = _unb64(value)
                if len(decoded) != 32:
                    raise ValueError
            except (ValueError, TypeError) as exc:
                raise ValueError("trusted peer keys must be URL-safe base64 Ed25519 keys") from exc
            keys.add(decoded)
        return cls(keys)

    def trusts(self, public_key: bytes) -> bool:
        return isinstance(public_key, bytes) and len(public_key) == 32 and public_key in self._keys

    def add(self, public_key: bytes) -> "TrustedPeerStore":
        public_key_from_bytes(public_key)
        return TrustedPeerStore(set(self._keys) | {public_key})

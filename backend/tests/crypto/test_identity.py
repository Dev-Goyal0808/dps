from __future__ import annotations

import hashlib
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization

from app.crypto.identity import (
    IdentityKeyPair,
    TrustedPeerStore,
    public_key_from_b64,
    verify_signature,
)
from app.utils.errors import BackendError


def _pem(identity: IdentityKeyPair) -> bytes:
    return identity.private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )


def test_ed25519_identity_signing_fingerprint_and_trust_lookup() -> None:
    identity = IdentityKeyPair.generate()
    data = b"authenticated handshake transcript"
    signature = identity.sign(data)

    verify_signature(identity.public_bytes, signature, data)
    assert public_key_from_b64(identity.public_key_b64).public_bytes(
        serialization.Encoding.Raw,
        serialization.PublicFormat.Raw,
    ) == identity.public_bytes
    assert identity.fingerprint == f"sha256:{hashlib.sha256(identity.public_bytes).hexdigest()}"
    assert TrustedPeerStore.from_b64([identity.public_key_b64]).trusts(identity.public_bytes)


@pytest.mark.parametrize("value", ["not-base64", "!!!!", "AA", "\u2603"])
def test_identity_base64_and_signature_inputs_are_rejected_safely(value: str) -> None:
    with pytest.raises(ValueError):
        public_key_from_b64(value)
    with pytest.raises(ValueError):
        TrustedPeerStore.from_b64([value])

    identity = IdentityKeyPair.generate()
    with pytest.raises(BackendError):
        verify_signature(identity.public_bytes, b"bad", b"data")


def test_identity_loader_requires_private_file_permissions(tmp_path: Path) -> None:
    path = tmp_path / "identity.pem"
    identity = IdentityKeyPair.generate()
    path.write_bytes(_pem(identity))
    path.chmod(0o644)

    with pytest.raises(BackendError):
        IdentityKeyPair.load(path)

    path.chmod(0o600)
    assert IdentityKeyPair.load(path).public_bytes == identity.public_bytes


def test_identity_repr_does_not_include_private_key_object() -> None:
    assert repr(IdentityKeyPair.generate()) == "IdentityKeyPair()"

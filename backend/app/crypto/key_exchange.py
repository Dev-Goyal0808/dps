"""Authenticated ephemeral X25519 handshake signed by Ed25519 identities."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
from dataclasses import dataclass, field

from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.crypto.identity import IdentityKeyPair, TrustedPeerStore, verify_signature
from app.crypto.key_derivation import FINISHED_KEY_INFO, derive_key
from app.utils.errors import BackendError, ErrorCode


PROTOCOL_VERSION = 1


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii")


def _decode(value: str) -> bytes:
    if not isinstance(value, str):
        raise ValueError("a base64 value must be text")
    try:
        encoded = value.encode("ascii")
        decoded = base64.b64decode(encoded, altchars=b"-_", validate=True)
    except (UnicodeEncodeError, binascii.Error, ValueError) as exc:
        raise ValueError("the base64 value is invalid") from exc
    if _encode(decoded) != value:
        raise ValueError("the base64 value is not canonical")
    return decoded


def _canonical(data: dict[str, object]) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _load_json(data: bytes) -> dict[str, object]:
    if not isinstance(data, bytes):
        raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake message is malformed.")
    try:
        value = json.loads(data.decode("utf-8"), parse_constant=_reject_json_constant)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake message is malformed.") from exc
    if not isinstance(value, dict):
        raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake message is malformed.")
    return value


def _reject_json_constant(value: str) -> None:
    raise ValueError(f"unsupported JSON constant: {value}")


def _require_text(data: dict[str, object], key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str):
        raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake message is malformed.")
    return value


def _require_version(data: dict[str, object]) -> None:
    if type(data.get("version")) is not int or data["version"] != PROTOCOL_VERSION:
        raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake version or role is invalid.")


def _exchange(private_key: X25519PrivateKey, peer_key: X25519PublicKey) -> bytes:
    try:
        return private_key.exchange(peer_key)
    except (TypeError, ValueError) as exc:
        raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake key exchange failed.") from exc


@dataclass(frozen=True)
class HandshakeResult:
    session_key: bytes = field(repr=False)
    transcript_hash: bytes
    peer_identity: bytes


class InitiatorHandshake:
    def __init__(self, identity: IdentityKeyPair, expected_peer: bytes, session_id: str) -> None:
        self.identity = identity
        self.expected_peer = expected_peer
        self.session_id = session_id
        self.ephemeral = X25519PrivateKey.generate()
        self.nonce = os.urandom(32)
        self._client_unsigned: bytes | None = None
        self._server_unsigned: bytes | None = None
        self.result: HandshakeResult | None = None

    def client_hello(self) -> bytes:
        body: dict[str, object] = {
            "role": "sender",
            "version": PROTOCOL_VERSION,
            "session_id": self.session_id,
            "identity": self.identity.public_key_b64,
            "ephemeral": _encode(
                self.ephemeral.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
            ),
            "nonce": _encode(self.nonce),
        }
        self._client_unsigned = _canonical(body)
        body["signature"] = _encode(self.identity.sign(self._client_unsigned))
        return _canonical(body)

    def process_server_hello(self, data: bytes) -> bytes:
        if self._client_unsigned is None:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake state is invalid.")
        body = _load_json(data)
        if body.get("role") != "receiver":
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake version or role is invalid.")
        _require_version(body)
        if _require_text(body, "session_id") != self.session_id:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake session is invalid.")
        if _require_text(body, "nonce") != _encode(self.nonce):
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake nonce is invalid.")
        try:
            peer_identity = _decode(_require_text(body, "identity"))
            peer_ephemeral = X25519PublicKey.from_public_bytes(_decode(_require_text(body, "ephemeral")))
            signature = _decode(_require_text(body, "signature"))
        except (ValueError, TypeError, binascii.Error) as exc:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake key material is invalid.") from exc
        if peer_identity != self.expected_peer:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The peer identity is not trusted.")
        server_unsigned = dict(body)
        server_unsigned.pop("signature", None)
        self._server_unsigned = _canonical(server_unsigned)
        transcript = self._client_unsigned + b"|" + self._server_unsigned
        try:
            verify_signature(peer_identity, signature, transcript)
        except BackendError:
            raise
        shared = _exchange(self.ephemeral, peer_ephemeral)
        session_key = derive_key(shared, transcript)
        self.result = HandshakeResult(session_key, hashlib.sha256(transcript).digest(), peer_identity)
        finished_key = derive_key(self.result.session_key, transcript, info=FINISHED_KEY_INFO)
        mac = hmac.new(finished_key, b"StegoCrypt finished|sender|" + self.result.transcript_hash, hashlib.sha256).digest()
        return _canonical({"role": "sender", "mac": _encode(mac)})

    def verify_server_finished(self, data: bytes) -> None:
        if self.result is None or self._client_unsigned is None or self._server_unsigned is None:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake state is invalid.")
        body = _load_json(data)
        if body.get("role") != "receiver" or set(body) != {"role", "mac"}:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake finished role is invalid.")
        try:
            received = _decode(_require_text(body, "mac"))
        except (ValueError, TypeError, binascii.Error) as exc:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake finished message is invalid.") from exc
        expected = hmac.new(
            derive_key(self.result.session_key, self._client_unsigned + b"|" + self._server_unsigned, info=FINISHED_KEY_INFO),
            b"StegoCrypt finished|receiver|" + self.result.transcript_hash,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(received, expected):
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake confirmation failed.")


class ResponderHandshake:
    def __init__(
        self,
        identity: IdentityKeyPair,
        trusted_peers: TrustedPeerStore,
        session_id: str,
    ) -> None:
        self.identity = identity
        self.trusted_peers = trusted_peers
        self.session_id = session_id
        self.ephemeral = X25519PrivateKey.generate()
        self._client_unsigned: bytes | None = None
        self._server_unsigned: bytes | None = None
        self.result: HandshakeResult | None = None

    def process_client_hello(self, data: bytes) -> tuple[bytes, bytes]:
        body = _load_json(data)
        if body.get("role") != "sender":
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake version or role is invalid.")
        _require_version(body)
        if _require_text(body, "session_id") != self.session_id:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake session is invalid.")
        try:
            sender_identity = _decode(_require_text(body, "identity"))
            sender_ephemeral = X25519PublicKey.from_public_bytes(_decode(_require_text(body, "ephemeral")))
            nonce = _decode(_require_text(body, "nonce"))
            signature = _decode(_require_text(body, "signature"))
        except (ValueError, TypeError, binascii.Error) as exc:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake key material is invalid.") from exc
        if len(sender_identity) != 32 or len(nonce) != 32 or not self.trusted_peers.trusts(sender_identity):
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The peer identity is not trusted.")
        unsigned = dict(body)
        unsigned.pop("signature", None)
        self._client_unsigned = _canonical(unsigned)
        try:
            verify_signature(sender_identity, signature, self._client_unsigned)
        except BackendError:
            raise
        server_body: dict[str, object] = {
            "role": "receiver",
            "version": PROTOCOL_VERSION,
            "session_id": self.session_id,
            "identity": self.identity.public_key_b64,
            "ephemeral": _encode(
                self.ephemeral.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
            ),
            "nonce": _encode(nonce),
        }
        self._server_unsigned = _canonical(server_body)
        transcript = self._client_unsigned + b"|" + self._server_unsigned
        server_body["signature"] = _encode(self.identity.sign(transcript))
        shared = _exchange(self.ephemeral, sender_ephemeral)
        self.result = HandshakeResult(
            derive_key(shared, transcript), hashlib.sha256(transcript).digest(), sender_identity
        )
        finished_key = derive_key(self.result.session_key, transcript, info=FINISHED_KEY_INFO)
        finished = _canonical(
            {
                "role": "receiver",
                "mac": _encode(
                    hmac.new(
                        finished_key,
                        b"StegoCrypt finished|receiver|" + self.result.transcript_hash,
                        hashlib.sha256,
                    ).digest()
                ),
            }
        )
        return _canonical(server_body), finished

    def verify_client_finished(self, data: bytes) -> None:
        if self.result is None or self._client_unsigned is None or self._server_unsigned is None:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake state is invalid.")
        body = _load_json(data)
        if body.get("role") != "sender" or set(body) != {"role", "mac"}:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake finished role is invalid.")
        try:
            received = _decode(_require_text(body, "mac"))
        except (ValueError, TypeError, binascii.Error) as exc:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake finished message is invalid.") from exc
        expected = hmac.new(
            derive_key(self.result.session_key, self._client_unsigned + b"|" + self._server_unsigned, info=FINISHED_KEY_INFO),
            b"StegoCrypt finished|sender|" + self.result.transcript_hash,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(received, expected):
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The handshake confirmation failed.")

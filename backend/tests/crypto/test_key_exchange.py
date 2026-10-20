from __future__ import annotations

import base64
import json
import uuid

import pytest

from app.crypto.identity import IdentityKeyPair, TrustedPeerStore
from app.crypto.aead import decrypt, encrypt
from app.crypto.key_exchange import InitiatorHandshake, ResponderHandshake
from app.utils.errors import BackendError


def _canonical(data: dict[str, object]) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _handshake() -> tuple[InitiatorHandshake, ResponderHandshake]:
    sender = IdentityKeyPair.generate()
    receiver = IdentityKeyPair.generate()
    session_id = str(uuid.uuid4())
    initiator = InitiatorHandshake(sender, receiver.public_bytes, session_id)
    responder = ResponderHandshake(receiver, TrustedPeerStore({sender.public_bytes}), session_id)
    client_hello = initiator.client_hello()
    server_hello, server_finished = responder.process_client_hello(client_hello)
    client_finished = initiator.process_server_hello(server_hello)
    initiator.verify_server_finished(server_finished)
    responder.verify_client_finished(client_finished)
    return initiator, responder


def test_authenticated_handshake_derives_the_same_key() -> None:
    initiator, responder = _handshake()
    assert initiator.result is not None
    assert responder.result is not None
    assert initiator.result.session_key == responder.result.session_key
    assert initiator.result.session_key.hex() not in repr(initiator.result)


def test_handshake_key_encrypts_and_decrypts_a_message() -> None:
    initiator, responder = _handshake()
    assert initiator.result is not None
    assert responder.result is not None
    message_id = uuid.uuid4()
    payload = encrypt(
        initiator.result.session_key,
        "authenticated payload 🌍",
        session_id=initiator.session_id,
        message_id=message_id,
    )

    assert decrypt(
        responder.result.session_key,
        payload,
        session_id=initiator.session_id,
        expected_message_id=message_id,
    ) == "authenticated payload 🌍".encode()


def test_handshake_rejects_unknown_identity_and_modified_signature() -> None:
    sender = IdentityKeyPair.generate()
    receiver = IdentityKeyPair.generate()
    unknown = IdentityKeyPair.generate()
    session_id = str(uuid.uuid4())
    untrusted = ResponderHandshake(receiver, TrustedPeerStore({unknown.public_bytes}), session_id)
    hello = InitiatorHandshake(sender, receiver.public_bytes, session_id).client_hello()
    with pytest.raises(BackendError):
        untrusted.process_client_hello(hello)

    responder = ResponderHandshake(receiver, TrustedPeerStore({sender.public_bytes}), session_id)
    modified = bytearray(hello)
    modified[-2] = ord("A") if modified[-2] != ord("A") else ord("B")
    with pytest.raises(BackendError):
        responder.process_client_hello(bytes(modified))


def test_handshake_rejects_noncanonical_base64_and_low_order_x25519_key() -> None:
    sender = IdentityKeyPair.generate()
    receiver = IdentityKeyPair.generate()
    session_id = str(uuid.uuid4())
    initiator = InitiatorHandshake(sender, receiver.public_bytes, session_id)
    hello = initiator.client_hello()

    malformed = json.loads(hello.decode("utf-8"))
    malformed["identity"] = malformed["identity"].rstrip("=")
    with pytest.raises(BackendError):
        ResponderHandshake(receiver, TrustedPeerStore({sender.public_bytes}), session_id).process_client_hello(
            _canonical(malformed)
        )

    responder = ResponderHandshake(receiver, TrustedPeerStore({sender.public_bytes}), session_id)
    server_hello, _ = responder.process_client_hello(hello)
    server_body = json.loads(server_hello.decode("utf-8"))
    server_body["ephemeral"] = base64.urlsafe_b64encode(bytes(32)).decode("ascii")
    unsigned = dict(server_body)
    unsigned.pop("signature")
    client_body = json.loads(hello.decode("utf-8"))
    client_unsigned = dict(client_body)
    client_unsigned.pop("signature")
    transcript = _canonical(client_unsigned) + b"|" + _canonical(unsigned)
    server_body["signature"] = base64.urlsafe_b64encode(receiver.sign(transcript)).decode("ascii")

    with pytest.raises(BackendError):
        initiator.process_server_hello(_canonical(server_body))


def test_finished_confirmation_rejects_extra_fields_and_tampering() -> None:
    initiator, responder = _handshake()
    assert initiator.result is not None
    assert responder.result is not None

    finished = {"role": "receiver", "mac": base64.urlsafe_b64encode(b"x" * 32).decode("ascii"), "extra": 1}
    with pytest.raises(BackendError):
        initiator.verify_server_finished(_canonical(finished))

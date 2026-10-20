from __future__ import annotations

import base64
import uuid

import app.services.encryption_demo as encryption_demo_service
from app.crypto.payload import EncryptedPayload


def test_encryption_demo_returns_verified_ascii_metadata(client) -> None:
    response = client.post("/api/encryption-demo", json={"message": "hello from the crypto demo"})

    assert response.status_code == 200
    body = response.json()
    assert uuid.UUID(body["message_id"])
    assert body["recovery_status"] == "verified"
    assert body["recovered_message"] == "hello from the crypto demo"
    assert body["sender_fingerprint"].startswith("sha256:")
    assert body["receiver_fingerprint"].startswith("sha256:")
    assert body["sender_fingerprint"] != body["receiver_fingerprint"]
    assert len(body["transcript_hash"]) == 64

    ciphertext = base64.b64decode(body["ciphertext"])
    serialized = base64.b64decode(body["serialized_payload"])
    nonce = base64.b64decode(body["nonce"])
    assert len(ciphertext) >= 16
    assert len(nonce) == 12
    assert EncryptedPayload.parse(serialized, max_bytes=4096).ciphertext == ciphertext
    assert body["algorithm_details"] == {
        "identity": "Ed25519",
        "key_exchange": "X25519",
        "key_derivation": "HKDF-SHA256",
        "encryption": "AES-256-GCM",
        "payload_format": "EncryptedPayload v1",
    }
    assert "private_key" not in response.text
    assert "session_key" not in response.text


def test_encryption_demo_round_trips_unicode(client) -> None:
    message = "秘密メッセージ 🌍 — café"
    response = client.post("/api/encryption-demo", json={"message": message})

    assert response.status_code == 200
    assert response.json()["recovered_message"] == message


def test_encryption_demo_rejects_empty_message(client) -> None:
    response = client.post("/api/encryption-demo", json={"message": ""})

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "INVALID_REQUEST",
            "message": "The request is invalid.",
            "details": {},
        }
    }


def test_encryption_demo_rejects_oversized_utf8_message(client) -> None:
    response = client.post("/api/encryption-demo", json={"message": "🌍" * 1025})

    assert response.status_code == 413
    assert response.json()["error"] == {
        "code": "MESSAGE_TOO_LARGE",
        "message": "The message is too large.",
        "details": {"max_bytes": 4096},
    }


def test_encryption_demo_returns_safe_error_for_tampered_payload(client, monkeypatch) -> None:
    original_decrypt = encryption_demo_service.decrypt_serialized

    def decrypt_tampered(key, serialized, **kwargs):
        tampered = bytearray(serialized)
        tampered[-1] ^= 1
        return original_decrypt(key, bytes(tampered), **kwargs)

    monkeypatch.setattr(encryption_demo_service, "decrypt_serialized", decrypt_tampered)
    response = client.post("/api/encryption-demo", json={"message": "authenticated demo"})

    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "AUTHENTICATION_FAILED",
            "message": "The recovered payload could not be authenticated.",
            "details": {},
        }
    }
    assert "authenticated demo" not in response.text

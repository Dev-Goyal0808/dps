from __future__ import annotations

import base64
import uuid


def create_channel(client) -> dict[str, object]:
    response = client.post("/api/encryption/channels")
    assert response.status_code == 201
    return response.json()


def send_message(client, channel: dict[str, object], message: str):
    return client.post(
        f"/api/encryption/channels/{channel['session_id']}/send",
        headers={"Authorization": f"Bearer {channel['sender_token']}"},
        json={"message": message},
    )


def receive_message(client, channel: dict[str, object], message_id: str, **kwargs):
    return client.post(
        f"/api/encryption/channels/{channel['session_id']}/receive",
        headers={"Authorization": f"Bearer {channel['receiver_token']}"},
        json={"message_id": message_id, **kwargs},
    )


def test_channel_creation_returns_split_credentials_and_crypto_metadata(client) -> None:
    channel = create_channel(client)

    assert uuid.UUID(str(channel["session_id"]))
    assert isinstance(channel["sender_token"], str)
    assert isinstance(channel["receiver_token"], str)
    assert channel["sender_token"] != channel["receiver_token"]
    assert channel["sender_fingerprint"].startswith("sha256:")
    assert channel["receiver_fingerprint"].startswith("sha256:")
    assert channel["sender_fingerprint"] != channel["receiver_fingerprint"]
    assert len(channel["transcript_hash"]) == 64
    assert channel["algorithm_details"] == {
        "identity": "Ed25519",
        "key_exchange": "X25519",
        "key_derivation": "HKDF-SHA256",
        "encryption": "AES-256-GCM",
        "payload_format": "EncryptedPayload v1",
    }


def test_sender_stores_encrypted_payload_and_receiver_decrypts_it(client) -> None:
    channel = create_channel(client)
    sent = send_message(client, channel, "split channel secret")

    assert sent.status_code == 200
    sent_body = sent.json()
    assert uuid.UUID(sent_body["message_id"])
    assert sent_body["status"] == "stored"
    assert base64.b64decode(sent_body["ciphertext"])
    assert base64.b64decode(sent_body["serialized_payload"])
    assert base64.b64decode(sent_body["nonce"])
    assert "split channel secret" not in sent.text
    assert "session_key" not in sent.text
    assert "private_key" not in sent.text

    received = receive_message(
        client,
        channel,
        sent_body["message_id"],
        serialized_payload=sent_body["serialized_payload"],
    )

    assert received.status_code == 200
    assert received.json() == {
        "session_id": channel["session_id"],
        "message_id": sent_body["message_id"],
        "recovery_status": "verified",
        "plaintext": "split channel secret",
    }


def test_split_channel_round_trips_unicode(client) -> None:
    channel = create_channel(client)
    message = "秘密メッセージ 🌍 — café"

    sent = send_message(client, channel, message)
    received = receive_message(client, channel, sent.json()["message_id"])

    assert sent.status_code == 200
    assert received.status_code == 200
    assert received.json()["plaintext"] == message


def test_split_channel_rejects_wrong_role_authorization(client) -> None:
    channel = create_channel(client)
    sent = send_message(client, channel, "role scoped")
    message_id = sent.json()["message_id"]

    sender_using_receiver_token = client.post(
        f"/api/encryption/channels/{channel['session_id']}/send",
        headers={"Authorization": f"Bearer {channel['receiver_token']}"},
        json={"message": "should not encrypt"},
    )
    receiver_using_sender_token = client.post(
        f"/api/encryption/channels/{channel['session_id']}/receive",
        headers={"Authorization": f"Bearer {channel['sender_token']}"},
        json={"message_id": message_id},
    )

    assert sender_using_receiver_token.status_code == 403
    assert receiver_using_sender_token.status_code == 403
    assert sender_using_receiver_token.json()["error"]["code"] == "FORBIDDEN"
    assert receiver_using_sender_token.json()["error"]["code"] == "FORBIDDEN"


def test_receiver_rejects_tampered_stored_envelope(client) -> None:
    channel = create_channel(client)
    sent = send_message(client, channel, "tamper me")
    message_id = sent.json()["message_id"]
    service = client.app.state.encryption_demo
    stored = service._channels[channel["session_id"]].messages[message_id]
    tampered = bytearray(stored.serialized_payload)
    tampered[-1] ^= 1
    stored.serialized_payload = bytes(tampered)

    received = receive_message(client, channel, message_id)

    assert received.status_code == 400
    assert received.json() == {
        "error": {
            "code": "AUTHENTICATION_FAILED",
            "message": "The recovered payload could not be authenticated.",
            "details": {},
        }
    }
    assert "tamper me" not in received.text


def test_split_channel_rejects_malformed_and_oversized_requests(client) -> None:
    channel = create_channel(client)
    empty = send_message(client, channel, "")
    oversized = send_message(client, channel, "🌍" * 1025)
    malformed_receive = receive_message(client, channel, "not-a-uuid")
    extra_field = client.post(
        f"/api/encryption/channels/{channel['session_id']}/send",
        headers={"Authorization": f"Bearer {channel['sender_token']}"},
        json={"message": "valid", "unexpected": True},
    )

    assert empty.status_code == 422
    assert oversized.status_code == 413
    assert oversized.json()["error"]["code"] == "MESSAGE_TOO_LARGE"
    assert malformed_receive.status_code == 422
    assert extra_field.status_code == 422

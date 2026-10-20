from __future__ import annotations

import uuid

from conftest import png_bytes, wait_for_result


def _paired(client) -> tuple[dict[str, object], dict[str, object]]:
    receiver = client.post("/api/sessions", json={"role": "receiver"}).json()
    sender = client.post(
        f"/api/sessions/{receiver['session_id']}/connect",
        json={"join_code": receiver["join_code"]},
    ).json()
    return receiver, sender


def test_complete_flow_returns_verified_plaintext_and_metrics(client) -> None:
    receiver, sender = _paired(client)
    response = client.post(
        "/api/messages/send",
        headers={"Authorization": f"Bearer {sender['sender_token']}"},
        data={"session_id": receiver["session_id"], "message": "verified 🌍"},
        files={"cover_image": ("cover.bin", png_bytes(), "application/octet-stream")},
    )
    assert response.status_code == 201
    message_id = response.json()["message_id"]
    result = wait_for_result(client, message_id, receiver["receiver_token"])
    assert result["recovery_status"] == "verified"
    assert result["message"] == "verified 🌍"
    assert result["metrics"]["payload_bytes"] > 0
    assert result["metrics"]["ssim"] > 0.9
    image = client.get(
        f"/api/messages/{message_id}/image",
        headers={"Authorization": f"Bearer {receiver['receiver_token']}"},
    )
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"
    assert image.headers["cache-control"] == "no-store"


def test_sender_cannot_retrieve_receiver_plaintext(client) -> None:
    receiver, sender = _paired(client)
    response = client.post(
        "/api/messages/send",
        headers={"Authorization": f"Bearer {sender['sender_token']}"},
        data={"session_id": receiver["session_id"], "message": "secret"},
        files={"cover_image": ("cover.png", png_bytes(), "image/png")},
    )
    message_id = response.json()["message_id"]
    denied = client.get(
        f"/api/messages/{message_id}/result",
        headers={"Authorization": f"Bearer {sender['sender_token']}"},
    )
    assert denied.status_code == 403
    assert "secret" not in denied.text


def test_invalid_upload_and_oversized_message_are_rejected(client) -> None:
    receiver, sender = _paired(client)
    invalid_image = client.post(
        "/api/messages/send",
        headers={"Authorization": f"Bearer {sender['sender_token']}"},
        data={"session_id": receiver["session_id"], "message": "hello"},
        files={"cover_image": ("not.png", b"not an image", "image/png")},
    )
    assert invalid_image.status_code == 400
    assert invalid_image.json()["error"]["code"] == "INVALID_IMAGE"
    oversized = client.post(
        "/api/messages/send",
        headers={"Authorization": f"Bearer {sender['sender_token']}"},
        data={"session_id": receiver["session_id"], "message": "x" * 5000},
        files={"cover_image": ("cover.png", png_bytes(), "image/png")},
    )
    assert oversized.status_code == 413
    assert oversized.json()["error"]["code"] == "MESSAGE_TOO_LARGE"


def test_rejected_result_never_contains_plaintext(client) -> None:
    receiver, _ = _paired(client)
    message_id = "00000000-0000-0000-0000-000000000001"
    client.app.state.results.create(receiver["session_id"], uuid.UUID(message_id))
    client.app.state.results.mark_rejected(
        message_id,
        "AUTHENTICATION_FAILED",
        "The recovered payload could not be authenticated.",
    )
    response = client.get(
        f"/api/messages/{message_id}/result",
        headers={"Authorization": f"Bearer {receiver['receiver_token']}"},
    )
    assert response.status_code == 200
    assert response.json()["recovery_status"] == "rejected"
    assert response.json()["message"] is None
    assert "plaintext" not in response.text

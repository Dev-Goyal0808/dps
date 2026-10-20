from __future__ import annotations

import time

from conftest import png_bytes, wait_for_result


def test_end_to_end_uses_tcp_crypto_and_qim(client) -> None:
    receiver = client.post("/api/sessions", json={"role": "receiver"}).json()
    sender = client.post(
        f"/api/sessions/{receiver['session_id']}/connect",
        json={"join_code": receiver["join_code"]},
    ).json()
    sent = client.post(
        "/api/messages/send",
        headers={"Authorization": f"Bearer {sender['sender_token']}"},
        data={"session_id": receiver["session_id"], "message": "end-to-end"},
        files={"cover_image": ("cover.jpg", png_bytes(160, 160), "image/jpeg")},
    )
    assert sent.status_code == 201
    result = wait_for_result(client, sent.json()["message_id"], receiver["receiver_token"])
    assert result["recovery_status"] == "verified"
    assert result["message"] == "end-to-end"
    for _ in range(100):
        status = client.get(
            f"/api/sessions/{receiver['session_id']}/status",
            headers={"Authorization": f"Bearer {receiver['receiver_token']}"},
        )
        if status.json()["phase"] == "completed":
            break
        time.sleep(0.01)
    else:
        raise AssertionError(f"unexpected final session phase: {status.json()['phase']}")

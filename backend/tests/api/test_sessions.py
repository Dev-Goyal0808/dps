from __future__ import annotations


def test_session_pairing_consumes_join_code_and_scopes_tokens(client) -> None:
    created = client.post("/api/sessions", json={"role": "receiver"})
    assert created.status_code == 201
    details = created.json()
    connected = client.post(
        f"/api/sessions/{details['session_id']}/connect",
        json={"join_code": details["join_code"]},
    )
    assert connected.status_code == 200
    sender = connected.json()["sender_token"]
    reused = client.post(
        f"/api/sessions/{details['session_id']}/connect",
        json={"join_code": details["join_code"]},
    )
    assert reused.status_code == 409
    status = client.get(
        f"/api/sessions/{details['session_id']}/status",
        headers={"Authorization": f"Bearer {sender}"},
    )
    assert status.status_code == 200
    assert status.json()["status"] == "connected"


def test_missing_token_and_invalid_join_code_are_safe_errors(client) -> None:
    created = client.post("/api/sessions", json={"role": "receiver"}).json()
    missing = client.get(f"/api/sessions/{created['session_id']}/status")
    assert missing.status_code == 401
    invalid = client.post(
        f"/api/sessions/{created['session_id']}/connect",
        json={"join_code": "WRONG"},
    )
    assert invalid.status_code == 400
    assert set(invalid.json()) == {"error"}

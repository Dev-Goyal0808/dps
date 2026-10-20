from __future__ import annotations


def test_health_reports_tcp_listener(client) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["tcp_listener"] == "ready"

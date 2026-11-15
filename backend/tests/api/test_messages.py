from __future__ import annotations

import math
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
    metrics = result["metrics"]
    assert metrics["payload_bytes"] > 0
    assert metrics["ssim"] > 0.9
    # Every value below must come from this run, not a constant.
    assert metrics["plaintext_match"] is True
    assert metrics["changed_samples"] > 0
    # Capacity is 3 samples per pixel packed into bytes, so this ties the
    # sample count to the image actually processed.
    assert metrics["total_samples"] == metrics["capacity_bytes"] * 8
    assert 0 < metrics["changed_sample_ratio"] < 1
    assert metrics["max_abs_error"] <= 8
    assert metrics["mse"] > 0
    assert metrics["rmse"] == round(math.sqrt(metrics["mse"]), 6) or abs(
        metrics["rmse"] - math.sqrt(metrics["mse"])
    ) < 1e-4
    assert metrics["embedding_rate_bpp"] > 0
    entropy_ceiling = metrics["ciphertext_entropy_ceiling_bits_per_byte"]
    assert entropy_ceiling is not None
    assert metrics["ciphertext_entropy_bits_per_byte"] <= entropy_ceiling + 1e-4
    assert metrics["ciphertext_entropy_bits_per_byte"] > entropy_ceiling * 0.9
    assert metrics["payload_overhead_bytes"] == 51
    assert metrics["workflow_time_ms"] > 0
    assert metrics["payload_throughput_bytes_per_second"] > 0
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
    # No plaintext may survive in a rejected result: the payload fields are
    # empty and the round-trip comparison was never made.
    assert response.json()["metrics"]["plaintext_bytes"] == 0
    assert response.json()["metrics"]["plaintext_match"] is None


def test_preview_exposes_ciphertext_and_embedded_bits(client) -> None:
    receiver, sender = _paired(client)
    sender_headers = {"Authorization": f"Bearer {sender['sender_token']}"}
    response = client.post(
        "/api/messages/preview",
        headers=sender_headers,
        data={"session_id": receiver["session_id"], "message": "preview me"},
        files={"cover_image": ("cover.png", png_bytes(), "image/png")},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["encryption"]["ciphertext_hex"]) > 0
    assert len(body["encryption"]["tag_hex"]) == 32
    assert len(body["encryption"]["nonce_hex"]) == 24
    assert body["stego"]["header"]["magic"] == "SCQ1"
    assert body["stego"]["header"]["payload_length"] == body["encryption"]["payload_bytes"]
    assert body["stego"]["bits_embedded"] == body["stego"]["container_bytes"] * 8
    assert body["stego"]["bit_placements"]
    assert body["stego"]["header"]["payload_crc32"] >= 0

    image = client.get(body["stego"]["stego_image_url"], headers=sender_headers)
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"

    # A preview must not advance the workflow or start a transfer.
    status = client.get(
        f"/api/sessions/{receiver['session_id']}/status",
        headers={"Authorization": f"Bearer {receiver['receiver_token']}"},
    )
    assert status.json()["phase"] == "connected"


def test_preview_requires_sender_token_and_connected_session(client) -> None:
    receiver, _ = _paired(client)
    unauthorized = client.post(
        "/api/messages/preview",
        data={"session_id": receiver["session_id"], "message": "hello"},
    )
    assert unauthorized.status_code == 401

    unpaired = client.post(
        "/api/sessions",
        json={"role": "receiver"},
    ).json()
    pending_sender = client.post(
        f"/api/sessions/{unpaired['session_id']}/connect",
        json={"join_code": unpaired["join_code"]},
    ).json()
    # Pairing succeeds, but an expired / non-connected session must be rejected.
    client.app.state.sessions.update_phase(unpaired["session_id"], "completed")
    rejected = client.post(
        "/api/messages/preview",
        headers={"Authorization": f"Bearer {pending_sender['sender_token']}"},
        data={"session_id": unpaired["session_id"], "message": "hello"},
    )
    assert rejected.status_code == 409


def test_evaluation_honours_include_image_comparison(client) -> None:
    receiver, sender = _paired(client)
    send = client.post(
        "/api/messages/send",
        headers={"Authorization": f"Bearer {sender['sender_token']}"},
        data={"session_id": receiver["session_id"], "message": "evaluation flag"},
        files={"cover_image": ("cover.png", png_bytes(), "image/png")},
    )
    message_id = send.json()["message_id"]
    wait_for_result(client, message_id, receiver["receiver_token"])
    headers = {"Authorization": f"Bearer {receiver['receiver_token']}"}

    full = client.post(
        "/api/evaluation",
        headers=headers,
        json={"message_id": message_id, "include_image_comparison": True},
    )
    assert full.status_code == 200
    assert full.json()["metrics"]["psnr"] is not None
    assert full.json()["metrics"]["changed_samples"] > 0
    assert full.json()["metrics"]["embedding_rate_bpp"] > 0

    trimmed = client.post(
        "/api/evaluation",
        headers=headers,
        json={"message_id": message_id, "include_image_comparison": False},
    )
    assert trimmed.status_code == 200
    body = trimmed.json()["metrics"]
    assert body["psnr"] is None
    assert body["ssim"] is None
    assert body["changed_samples"] is None
    # Transport, capacity, crypto, and recovery measurements are unaffected.
    assert body["throughput_bytes_per_second"] > 0
    assert body["ciphertext_entropy_bits_per_byte"] > 0
    assert body["plaintext_match"] is True


def test_entropy_reflects_the_embedded_payload(client) -> None:
    receiver, sender = _paired(client)
    message = "entropy " * 128  # 1024 bytes, within the test image capacity
    send = client.post(
        "/api/messages/send",
        headers={"Authorization": f"Bearer {sender['sender_token']}"},
        data={"session_id": receiver["session_id"], "message": message},
        files={"cover_image": ("cover.png", png_bytes(), "image/png")},
    )
    message_id = send.json()["message_id"]
    result = wait_for_result(client, message_id, receiver["receiver_token"])
    metrics = result["metrics"]
    assert metrics["payload_bytes"] == 1024 + 51
    assert metrics["ciphertext_entropy_ceiling_bits_per_byte"] == 8.0
    # A 1 KiB ciphertext should look close to uniform, unlike a short sample
    # where log2(N) itself limits the value.
    assert metrics["ciphertext_entropy_bits_per_byte"] > 7.3
    assert metrics["changed_samples"] > 0
    assert metrics["plaintext_match"] is True

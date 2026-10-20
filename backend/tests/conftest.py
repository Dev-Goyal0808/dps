from __future__ import annotations

import io
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(
        tcp_port=0,
        max_image_width=512,
        max_image_height=512,
        max_message_bytes=4096,
        max_cover_image_bytes=2 * 1024 * 1024,
        max_stego_image_bytes=4 * 1024 * 1024,
        max_frame_bytes=4 * 1024 * 1024,
        chunk_size=4096,
    )


@pytest.fixture
def client(settings: Settings):
    application = create_app(settings)
    with TestClient(application) as test_client:
        yield test_client


def png_bytes(width: int = 128, height: int = 128) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (width, height), (120, 130, 140)).save(output, format="PNG")
    return output.getvalue()


def wait_for_result(client: TestClient, message_id: str, token: str) -> dict[str, object]:
    for _ in range(200):
        response = client.get(
            f"/api/messages/{message_id}/result",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code != 409:
            return response.json()
        time.sleep(0.01)
    pytest.fail("timed out waiting for the backend result")

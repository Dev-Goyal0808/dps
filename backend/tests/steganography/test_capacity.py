from __future__ import annotations

import pytest

from app.steganography.capacity import capacity_for, require_capacity
from app.utils.errors import BackendError


def test_capacity_uses_three_rgb_channels() -> None:
    capacity = capacity_for(8, 8)
    assert capacity.available_bits == 192
    assert capacity.available_bytes == 24


def test_capacity_rejects_payload_before_embedding() -> None:
    with pytest.raises(BackendError) as error:
        require_capacity(8, 8, 100)
    assert error.value.code == "INSUFFICIENT_CAPACITY"
    assert "required_bytes" in error.value.details

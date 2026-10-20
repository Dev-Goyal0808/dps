"""QIM capacity calculations and safe boundary errors."""

from __future__ import annotations

from dataclasses import dataclass

from app.utils.errors import BackendError, ErrorCode


HEADER_BYTES = 16


@dataclass(frozen=True)
class Capacity:
    width: int
    height: int
    available_bits: int
    available_bytes: int


def capacity_for(width: int, height: int, channels: int = 3) -> Capacity:
    if width < 1 or height < 1 or channels < 1:
        raise ValueError("image dimensions and channels must be positive")
    bits = width * height * channels
    return Capacity(width, height, bits, bits // 8)


def require_capacity(
    width: int,
    height: int,
    payload_bytes: int,
    *,
    channels: int = 3,
    header_bytes: int = HEADER_BYTES,
    quantizer_id: int = 1,
) -> Capacity:
    capacity = capacity_for(width, height, channels)
    required_bytes = header_bytes + payload_bytes
    required_bits = required_bytes * 8
    if required_bits > capacity.available_bits:
        raise BackendError(
            ErrorCode.INSUFFICIENT_CAPACITY,
            "The selected image cannot contain this payload.",
            status_code=413,
            details={
                "required_bytes": required_bytes,
                "available_bytes": capacity.available_bytes,
                "width": width,
                "height": height,
                "quantizer_id": quantizer_id,
            },
        )
    return capacity

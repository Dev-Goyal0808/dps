from __future__ import annotations

import pytest

from app.networking.framing import decode_frame, encode_frame, read_frame
from app.networking.protocol import FrameType
from app.utils.errors import BackendError


class FragmentedSocket:
    def __init__(self, data: bytes, fragment: int = 1) -> None:
        self.data = data
        self.fragment = fragment

    def recv(self, size: int) -> bytes:
        if not self.data:
            return b""
        count = min(size, self.fragment, len(self.data))
        chunk, self.data = self.data[:count], self.data[count:]
        return chunk


def test_frame_round_trip_handles_fragmented_prefix_and_body() -> None:
    encoded = encode_frame(FrameType.IMAGE_CHUNK, b"payload", max_frame_bytes=1024)
    frame = read_frame(FragmentedSocket(encoded), max_frame_bytes=1024)
    assert frame.frame_type is FrameType.IMAGE_CHUNK
    assert frame.body == b"payload"
    assert decode_frame(encoded, max_frame_bytes=1024) == frame


def test_frame_limits_and_unknown_types_are_rejected() -> None:
    with pytest.raises(BackendError):
        encode_frame(FrameType.ERROR, b"x" * 20, max_frame_bytes=4)
    with pytest.raises(BackendError):
        decode_frame(b"\x00\x00\x00\x01\xff", max_frame_bytes=1024)
    with pytest.raises(BackendError):
        read_frame(FragmentedSocket(b"\x00\x00\x00\x05ab"), max_frame_bytes=1024)

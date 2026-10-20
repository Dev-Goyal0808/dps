from __future__ import annotations

from PIL import Image

from app.steganography.qim import bytes_to_bits, embed_bits, extract_bits


def test_qim_round_trip_includes_boundary_samples_and_rgb_scan_order() -> None:
    image = Image.new("RGB", (16, 16))
    image.putdata([(0, 1, 254), (255, 128, 127)] * 128)
    data = bytes(range(32))
    embedded = embed_bits(image, bytes_to_bits(data), delta=8)
    assert bytes(extract_bits(embedded, len(data) * 8, delta=8)) != b""  # extraction returns bits
    from app.steganography.qim import bits_to_bytes

    assert bits_to_bytes(extract_bits(embedded, len(data) * 8, delta=8)) == data

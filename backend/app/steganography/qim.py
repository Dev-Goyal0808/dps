"""Scalar QIM embedding and extraction over RGB samples."""

from __future__ import annotations

from PIL import Image

from app.steganography.capacity import require_capacity
from app.steganography.payload_codec import HEADER_SIZE, decode_container, encode_container
from app.utils.errors import BackendError, ErrorCode


def bytes_to_bits(data: bytes) -> list[int]:
    return [(byte >> shift) & 1 for byte in data for shift in range(7, -1, -1)]


def bits_to_bytes(bits: list[int]) -> bytes:
    if len(bits) % 8:
        raise ValueError("bit count must be a multiple of eight")
    result = bytearray()
    for offset in range(0, len(bits), 8):
        value = 0
        for bit in bits[offset : offset + 8]:
            value = (value << 1) | bit
        result.append(value)
    return bytes(result)


def _quantize(sample: int, bit: int, delta: int) -> int:
    quantum = delta // 2
    max_level = 255 // quantum
    level = min(max(round(sample / quantum), 0), max_level)
    if level % 2 != bit:
        if level == max_level:
            level -= 1
        else:
            level += 1
    return max(0, min(255, level * quantum))


def _extract(sample: int, delta: int) -> int:
    quantum = delta // 2
    level = min(max(round(sample / quantum), 0), 255 // quantum)
    return level & 1


def embed_bits(image: Image.Image, bits: list[int], *, delta: int = 8) -> Image.Image:
    if delta < 2 or delta % 2:
        raise ValueError("delta must be an even integer of at least 2")
    rgb = image.convert("RGB")
    if len(bits) > rgb.width * rgb.height * 3:
        raise ValueError("the image does not contain enough RGB samples")
    pixels = list(rgb.getdata())
    output: list[tuple[int, int, int]] = []
    bit_index = 0
    for pixel in pixels:
        channels = list(pixel)
        for channel in range(3):
            if bit_index < len(bits):
                channels[channel] = _quantize(channels[channel], bits[bit_index], delta)
                bit_index += 1
        output.append((channels[0], channels[1], channels[2]))
    result = Image.new("RGB", rgb.size)
    result.putdata(output)  # type: ignore[arg-type]
    return result


def extract_bits(image: Image.Image, count: int, *, delta: int = 8) -> list[int]:
    if delta < 2 or delta % 2 or count < 0:
        raise ValueError("invalid QIM extraction parameters")
    if count > image.width * image.height * 3:
        raise ValueError("the requested bit count exceeds image capacity")
    bits: list[int] = []
    for pixel in image.convert("RGB").getdata():
        for channel in pixel:
            if len(bits) == count:
                return bits
            bits.append(_extract(channel, delta))
    return bits


def embed_payload(image: Image.Image, payload: bytes, *, delta: int = 8) -> Image.Image:
    container = encode_container(payload)
    require_capacity(image.width, image.height, len(payload), header_bytes=HEADER_SIZE)
    return embed_bits(image, bytes_to_bits(container), delta=delta)


def extract_payload(
    image: Image.Image,
    *,
    delta: int = 8,
    max_payload_bytes: int = 256 * 1024 + 1024,
) -> bytes:
    if image.width * image.height * 3 < HEADER_SIZE * 8:
        raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The image is too small for a stego header.")
    header = bits_to_bytes(extract_bits(image, HEADER_SIZE * 8, delta=delta))
    from app.steganography.payload_codec import StegoHeader

    parsed = StegoHeader.decode(header, max_payload_bytes=max_payload_bytes)
    total_bytes = HEADER_SIZE + parsed.payload_length
    require_capacity(image.width, image.height, parsed.payload_length, header_bytes=HEADER_SIZE)
    container = bits_to_bytes(extract_bits(image, total_bytes * 8, delta=delta))
    return decode_container(container, max_payload_bytes=max_payload_bytes)

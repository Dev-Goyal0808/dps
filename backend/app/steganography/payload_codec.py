"""Stego container header and CRC32 validation."""

from __future__ import annotations

import struct
import zlib
from dataclasses import dataclass

from app.utils.errors import BackendError, ErrorCode


MAGIC = b"SCQ1"
VERSION = 1
QUANTIZER_ID = 1
HEADER_FORMAT = ">4sBBHII"
HEADER_SIZE = struct.calcsize(HEADER_FORMAT)


@dataclass(frozen=True)
class StegoHeader:
    payload_length: int
    payload_crc32: int
    version: int = VERSION
    quantizer_id: int = QUANTIZER_ID

    def encode(self) -> bytes:
        return struct.pack(
            HEADER_FORMAT,
            MAGIC,
            self.version,
            self.quantizer_id,
            0,
            self.payload_length,
            self.payload_crc32,
        )

    @classmethod
    def decode(cls, data: bytes, *, max_payload_bytes: int) -> "StegoHeader":
        if len(data) != HEADER_SIZE:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The stego header is truncated.")
        try:
            magic, version, quantizer_id, reserved, length, crc = struct.unpack(HEADER_FORMAT, data)
        except struct.error as exc:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The stego header is malformed.") from exc
        if magic != MAGIC or version != VERSION or quantizer_id != QUANTIZER_ID or reserved != 0:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The stego header is unsupported.")
        if length > max_payload_bytes:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The stego payload is too large.")
        return cls(length, crc, version, quantizer_id)


def encode_container(payload: bytes) -> bytes:
    return StegoHeader(len(payload), zlib.crc32(payload) & 0xFFFFFFFF).encode() + payload


def decode_container(data: bytes, *, max_payload_bytes: int) -> bytes:
    if len(data) < HEADER_SIZE:
        raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The stego payload is truncated.")
    header = StegoHeader.decode(data[:HEADER_SIZE], max_payload_bytes=max_payload_bytes)
    expected = HEADER_SIZE + header.payload_length
    if len(data) != expected:
        raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The stego payload length is invalid.")
    payload = data[HEADER_SIZE:]
    if zlib.crc32(payload) & 0xFFFFFFFF != header.payload_crc32:
        raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The stego payload checksum is invalid.")
    return payload

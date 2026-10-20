"""Wire-level frame identifiers and transfer metadata structures."""

from __future__ import annotations

import hashlib
import struct
import uuid
from dataclasses import dataclass
from enum import IntEnum

from app.utils.errors import BackendError, ErrorCode


PROTOCOL_VERSION = 1


class FrameType(IntEnum):
    CLIENT_HELLO = 0x01
    SERVER_HELLO = 0x02
    HANDSHAKE_FINISHED = 0x03
    TRANSFER_METADATA = 0x04
    IMAGE_CHUNK = 0x05
    TRANSFER_COMPLETE = 0x06
    ERROR = 0x07


def known_frame_type(value: int) -> FrameType:
    try:
        return FrameType(value)
    except ValueError as exc:
        raise BackendError(ErrorCode.TRANSFER_FAILED, "The frame type is unknown.") from exc


@dataclass(frozen=True)
class TransferMetadata:
    message_id: uuid.UUID
    image_length: int
    image_sha256: bytes
    chunk_size: int
    chunk_count: int

    FORMAT = ">16sQ32sII"

    def encode(self) -> bytes:
        if len(self.image_sha256) != 32 or self.image_length < 0 or self.chunk_size < 1 or self.chunk_count < 1:
            raise ValueError("invalid transfer metadata")
        return struct.pack(
            self.FORMAT,
            self.message_id.bytes,
            self.image_length,
            self.image_sha256,
            self.chunk_size,
            self.chunk_count,
        )

    @classmethod
    def decode(cls, body: bytes, *, max_image_bytes: int, max_chunk_count: int) -> "TransferMetadata":
        if len(body) != struct.calcsize(cls.FORMAT):
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer metadata is malformed.")
        try:
            raw_id, image_length, digest, chunk_size, chunk_count = struct.unpack(cls.FORMAT, body)
            message_id = uuid.UUID(bytes=raw_id)
        except (struct.error, ValueError) as exc:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer metadata is malformed.") from exc
        if image_length > max_image_bytes or image_length < 1:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transferred image is too large.", status_code=413)
        if chunk_size < 1 or chunk_count < 1 or chunk_count > max_chunk_count:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer chunk settings are invalid.")
        expected_count = (image_length + chunk_size - 1) // chunk_size
        if expected_count != chunk_count:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer chunk count is invalid.")
        return cls(message_id, image_length, digest, chunk_size, chunk_count)


@dataclass(frozen=True)
class ImageChunk:
    sequence_number: int
    offset: int
    data: bytes

    def encode(self) -> bytes:
        if self.sequence_number < 0 or self.offset < 0:
            raise ValueError("chunk sequence and offset cannot be negative")
        return struct.pack(">IQI", self.sequence_number, self.offset, len(self.data)) + self.data

    @classmethod
    def decode(cls, body: bytes) -> "ImageChunk":
        prefix_size = struct.calcsize(">IQI")
        if len(body) < prefix_size:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The image chunk is malformed.")
        sequence, offset, length = struct.unpack(">IQI", body[:prefix_size])
        if length != len(body) - prefix_size:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The image chunk length is invalid.")
        return cls(sequence, offset, body[prefix_size:])


def image_digest(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()

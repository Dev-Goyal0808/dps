"""Four-byte length-prefixed TCP frames with exact reads and limits."""

from __future__ import annotations

import socket
import struct
from dataclasses import dataclass
from typing import Protocol

from app.networking.protocol import FrameType
from app.utils.errors import BackendError, ErrorCode


class Receivable(Protocol):
    def recv(self, size: int) -> bytes: ...


class Sendable(Protocol):
    def send(self, data: bytes) -> int: ...


@dataclass(frozen=True)
class Frame:
    frame_type: FrameType
    body: bytes


def encode_frame(frame_type: FrameType | int, body: bytes, *, max_frame_bytes: int) -> bytes:
    try:
        frame = FrameType(frame_type)
    except ValueError as exc:
        raise BackendError(ErrorCode.TRANSFER_FAILED, "The frame type is unknown.") from exc
    length = 1 + len(body)
    if length > max_frame_bytes or length > 0xFFFFFFFF:
        raise BackendError(ErrorCode.TRANSFER_FAILED, "The frame is too large.", status_code=413)
    return struct.pack(">I", length) + bytes((frame.value,)) + body


def decode_frame(data: bytes, *, max_frame_bytes: int) -> Frame:
    if len(data) < 5:
        raise BackendError(ErrorCode.TRANSFER_FAILED, "The frame is truncated.")
    length = struct.unpack(">I", data[:4])[0]
    if length > max_frame_bytes:
        raise BackendError(ErrorCode.TRANSFER_FAILED, "The frame is too large.", status_code=413)
    if len(data) != length + 4 or length < 1:
        raise BackendError(ErrorCode.TRANSFER_FAILED, "The frame length is invalid.")
    try:
        frame_type = FrameType(data[4])
    except ValueError as exc:
        raise BackendError(ErrorCode.TRANSFER_FAILED, "The frame type is unknown.") from exc
    return Frame(frame_type, data[5:])


def read_exact(sock: Receivable, count: int) -> bytes:
    if count < 0:
        raise ValueError("count cannot be negative")
    chunks = bytearray()
    while len(chunks) < count:
        try:
            chunk = sock.recv(count - len(chunks))
        except socket.timeout as exc:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer timed out.", status_code=503) from exc
        if not chunk:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The connection closed during transfer.", status_code=503)
        chunks.extend(chunk)
    return bytes(chunks)


def read_frame(sock: Receivable, *, max_frame_bytes: int) -> Frame:
    prefix = read_exact(sock, 4)
    length = struct.unpack(">I", prefix)[0]
    if length < 1 or length > max_frame_bytes:
        raise BackendError(ErrorCode.TRANSFER_FAILED, "The frame length is invalid.", status_code=413)
    body = read_exact(sock, length)
    try:
        frame_type = FrameType(body[0])
    except ValueError as exc:
        raise BackendError(ErrorCode.TRANSFER_FAILED, "The frame type is unknown.") from exc
    return Frame(frame_type, body[1:])


def write_all(sock: Sendable, data: bytes) -> None:
    sent = 0
    while sent < len(data):
        try:
            count = sock.send(data[sent:])
        except socket.timeout as exc:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The transfer timed out.", status_code=503) from exc
        if count <= 0:
            raise BackendError(ErrorCode.TRANSFER_FAILED, "The connection closed during transfer.", status_code=503)
        sent += count


def send_frame(sock: Sendable, frame_type: FrameType, body: bytes, *, max_frame_bytes: int) -> None:
    write_all(sock, encode_frame(frame_type, body, max_frame_bytes=max_frame_bytes))

"""Binary serialization for authenticated encrypted message payloads."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from app.utils.errors import BackendError, ErrorCode


MAGIC = b"SCEP"
PAYLOAD_VERSION = 1
ALGORITHM_AES_256_GCM = 1
NONCE_LENGTH = 12
TAG_LENGTH = 16
HEADER_SIZE = 4 + 1 + 1 + 1 + 16


@dataclass(frozen=True)
class EncryptedPayload:
    message_id: uuid.UUID
    nonce: bytes = field(repr=False)
    ciphertext: bytes = field(repr=False)
    version: int = PAYLOAD_VERSION
    algorithm: int = ALGORITHM_AES_256_GCM

    def validate(self) -> None:
        if not isinstance(self.message_id, uuid.UUID):
            raise ValueError("encrypted payload message ID must be a UUID")
        if type(self.version) is not int or self.version != PAYLOAD_VERSION:
            raise ValueError("encrypted payload version is unsupported")
        if type(self.algorithm) is not int or self.algorithm != ALGORITHM_AES_256_GCM:
            raise ValueError("encrypted payload algorithm is unsupported")
        if not isinstance(self.nonce, bytes) or len(self.nonce) != NONCE_LENGTH:
            raise ValueError("AES-GCM nonce must be 12 bytes")
        if not isinstance(self.ciphertext, bytes) or len(self.ciphertext) < TAG_LENGTH:
            raise ValueError("AES-GCM ciphertext must contain a tag")

    def serialize(self) -> bytes:
        self.validate()
        return b"".join(
            (
                MAGIC,
                bytes((self.version, self.algorithm, len(self.nonce))),
                self.message_id.bytes,
                self.nonce,
                self.ciphertext,
            )
        )

    @classmethod
    def parse(cls, data: bytes, *, max_bytes: int) -> "EncryptedPayload":
        if not isinstance(data, bytes) or type(max_bytes) is not int or max_bytes < 0:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The encrypted payload is malformed.")
        if len(data) > max_bytes:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The encrypted payload is too large.")
        if len(data) < HEADER_SIZE + NONCE_LENGTH + TAG_LENGTH:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The encrypted payload is truncated.")
        if data[:4] != MAGIC:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The encrypted payload magic is invalid.")
        version, algorithm, nonce_length = data[4:7]
        if version != PAYLOAD_VERSION or algorithm != ALGORITHM_AES_256_GCM:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The encrypted payload version is unsupported.")
        if nonce_length != NONCE_LENGTH:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The encrypted payload nonce is invalid.")
        start = HEADER_SIZE
        end_nonce = start + nonce_length
        if end_nonce + TAG_LENGTH > len(data):
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The encrypted payload boundaries are invalid.")
        try:
            message_id = uuid.UUID(bytes=data[7:23])
        except ValueError as exc:
            raise BackendError(ErrorCode.INVALID_STEGO_PAYLOAD, "The encrypted payload ID is invalid.") from exc
        return cls(message_id, data[start:end_nonce], data[end_nonce:], version, algorithm)

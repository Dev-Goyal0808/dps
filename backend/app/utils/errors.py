"""Stable, safe errors exposed by the backend."""

from __future__ import annotations

from typing import Any


class ErrorCode:
    INVALID_REQUEST = "INVALID_REQUEST"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    MESSAGE_NOT_FOUND = "MESSAGE_NOT_FOUND"
    JOIN_CODE_INVALID = "JOIN_CODE_INVALID"
    INVALID_IMAGE = "INVALID_IMAGE"
    IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE"
    MESSAGE_TOO_LARGE = "MESSAGE_TOO_LARGE"
    INSUFFICIENT_CAPACITY = "INSUFFICIENT_CAPACITY"
    KEY_EXCHANGE_FAILED = "KEY_EXCHANGE_FAILED"
    RECEIVER_UNAVAILABLE = "RECEIVER_UNAVAILABLE"
    TRANSFER_FAILED = "TRANSFER_FAILED"
    INVALID_STEGO_PAYLOAD = "INVALID_STEGO_PAYLOAD"
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED"
    RESULT_NOT_READY = "RESULT_NOT_READY"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class BackendError(Exception):
    """An expected failure with a public-safe code and details."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class CryptoError(BackendError):
    """Safe wrapper for cryptographic rejection."""


class ProtocolError(BackendError):
    """Safe wrapper for malformed or invalid transport protocol data."""


def safe_error(code: str, message: str, *, status_code: int = 400) -> BackendError:
    """Create an error without accepting implementation details from callers."""

    return BackendError(code, message, status_code=status_code)

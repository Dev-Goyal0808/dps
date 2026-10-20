"""Shared dependency helpers for bearer-token authorization."""

from __future__ import annotations

from fastapi import Header

from app.utils.errors import BackendError, ErrorCode


async def bearer_token(authorization: str | None = Header(default=None)) -> str:
    if authorization is None:
        raise BackendError(ErrorCode.UNAUTHORIZED, "A bearer token is required.", status_code=401)
    scheme, separator, token = authorization.partition(" ")
    if separator != " " or scheme.lower() != "bearer" or not token:
        raise BackendError(ErrorCode.UNAUTHORIZED, "A bearer token is required.", status_code=401)
    return token

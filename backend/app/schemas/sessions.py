"""Session and pairing API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from app.schemas.common import ApiError, StrictModel


class CreateSessionRequest(StrictModel):
    role: Literal["receiver"]


class CreateSessionResponse(StrictModel):
    session_id: str
    receiver_token: str
    join_code: str
    expires_at: datetime
    receiver_fingerprint: str
    status: str


class ConnectSessionRequest(StrictModel):
    join_code: str


class ConnectSessionResponse(StrictModel):
    session_id: str
    sender_token: str
    status: str


class SessionStatusResponse(StrictModel):
    session_id: str
    status: str
    phase: str
    progress: float
    bytes_sent: int
    bytes_total: int
    message_id: str | None = None
    error: ApiError | None = None
    updated_at: datetime

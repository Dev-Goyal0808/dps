"""In-memory session, pairing, token, and workflow state management."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from app.config import Settings
from app.utils.errors import BackendError, ErrorCode
from app.utils.security import hash_token, random_join_code, random_token, token_matches


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SessionPhase:
    WAITING = "waiting"
    PAIRING = "pairing"
    CONNECTED = "connected"
    VALIDATING = "validating"
    ENCRYPTING = "encrypting"
    EMBEDDING = "embedding"
    TRANSFERRING = "transferring"
    EXTRACTING = "extracting"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    REJECTED = "rejected"
    FAILED = "failed"
    EXPIRED = "expired"


@dataclass
class Session:
    session_id: str
    receiver_token_hash: bytes
    join_code_hash: bytes
    join_code_expires_at: datetime
    expires_at: datetime
    status: str = SessionPhase.WAITING
    phase: str = SessionPhase.WAITING
    sender_token_hash: bytes | None = None
    attempts: int = 0
    message_id: str | None = None
    progress: float = 0.0
    bytes_sent: int = 0
    bytes_total: int = 0
    error: dict[str, object] | None = None
    updated_at: datetime = field(default_factory=utc_now)


class SessionManager:
    def __init__(self, settings: Settings, receiver_fingerprint: str) -> None:
        self.settings = settings
        self.receiver_fingerprint = receiver_fingerprint
        self._sessions: dict[str, Session] = {}
        self._lock = threading.RLock()

    def create_receiver(self) -> tuple[Session, str, str, str]:
        now = utc_now()
        session_id = str(uuid.uuid4())
        receiver_token = random_token()
        join_code = random_join_code()
        session = Session(
            session_id=session_id,
            receiver_token_hash=hash_token(receiver_token),
            join_code_hash=hash_token(join_code),
            join_code_expires_at=now + timedelta(seconds=self.settings.join_code_lifetime_seconds),
            expires_at=now + timedelta(seconds=self.settings.session_lifetime_seconds),
        )
        with self._lock:
            self._sessions[session_id] = session
        return session, receiver_token, join_code, self.receiver_fingerprint

    def connect_sender(self, session_id: str, join_code: str) -> tuple[Session, str]:
        with self._lock:
            session = self._get_active(session_id)
            if session.sender_token_hash is not None or session.status != SessionPhase.WAITING:
                raise BackendError(ErrorCode.JOIN_CODE_INVALID, "The join code is no longer available.", status_code=409)
            if utc_now() > session.join_code_expires_at:
                session.status = SessionPhase.EXPIRED
                session.phase = SessionPhase.EXPIRED
                raise BackendError(ErrorCode.SESSION_EXPIRED, "The session has expired.", status_code=409)
            session.attempts += 1
            if session.attempts > 5 or not token_matches(join_code, session.join_code_hash):
                raise BackendError(ErrorCode.JOIN_CODE_INVALID, "The join code is invalid.", status_code=400)
            sender_token = random_token()
            session.sender_token_hash = hash_token(sender_token)
            session.join_code_hash = b""
            session.status = SessionPhase.CONNECTED
            session.phase = SessionPhase.CONNECTED
            session.updated_at = utc_now()
            return session, sender_token

    def authorize(self, session_id: str, token: str, role: str) -> Session:
        with self._lock:
            session = self._get_active(session_id, allow_expired_state=True)
            if session.status == SessionPhase.EXPIRED:
                raise BackendError(ErrorCode.SESSION_EXPIRED, "The session has expired.", status_code=409)
            if role == "receiver" and token_matches(token, session.receiver_token_hash):
                return session
            if role == "sender" and session.sender_token_hash is not None and token_matches(token, session.sender_token_hash):
                return session
            if role in {"sender", "receiver"}:
                try:
                    if token_matches(token, session.receiver_token_hash) or (
                        session.sender_token_hash is not None and token_matches(token, session.sender_token_hash)
                    ):
                        raise BackendError(ErrorCode.FORBIDDEN, "The bearer token has the wrong role.", status_code=403)
                except BackendError:
                    raise
            raise BackendError(ErrorCode.UNAUTHORIZED, "The bearer token is invalid.", status_code=401)

    def identify_role(self, session_id: str, token: str) -> tuple[Session, str]:
        with self._lock:
            session = self._get_active(session_id, allow_expired_state=True)
            if session.status == SessionPhase.EXPIRED:
                raise BackendError(ErrorCode.SESSION_EXPIRED, "The session has expired.", status_code=409)
            if token_matches(token, session.receiver_token_hash):
                return session, "receiver"
            if session.sender_token_hash is not None and token_matches(token, session.sender_token_hash):
                return session, "sender"
            raise BackendError(ErrorCode.UNAUTHORIZED, "The bearer token is invalid.", status_code=401)

    def update_phase(
        self,
        session_id: str,
        phase: str,
        *,
        message_id: str | None = None,
        progress: float | None = None,
        bytes_sent: int | None = None,
        bytes_total: int | None = None,
        error: dict[str, object] | None = None,
    ) -> None:
        with self._lock:
            session = self._get_active(session_id, allow_expired_state=True)
            session.phase = phase
            session.status = phase
            if message_id is not None:
                session.message_id = message_id
            if progress is not None:
                session.progress = min(max(progress, 0.0), 1.0)
            if bytes_sent is not None:
                session.bytes_sent = max(0, bytes_sent)
            if bytes_total is not None:
                session.bytes_total = max(0, bytes_total)
            if error is not None:
                session.error = {"code": str(error.get("code", ErrorCode.TRANSFER_FAILED)), "message": str(error.get("message", "The transfer failed."))}
            session.updated_at = utc_now()

    def get_status(self, session_id: str) -> Session:
        with self._lock:
            return self._get_active(session_id, allow_expired_state=True)

    def is_active(self, session_id: str) -> bool:
        try:
            with self._lock:
                session = self._get_active(session_id, allow_expired_state=True)
                return session.status not in {SessionPhase.EXPIRED}
        except BackendError:
            return False

    def can_accept_transfer(self, session_id: str) -> bool:
        allowed = {
            SessionPhase.CONNECTED,
            SessionPhase.VALIDATING,
            SessionPhase.ENCRYPTING,
            SessionPhase.EMBEDDING,
            SessionPhase.TRANSFERRING,
        }
        try:
            with self._lock:
                session = self._get_active(session_id, allow_expired_state=True)
                return session.status in allowed
        except BackendError:
            return False

    def cleanup(self) -> None:
        now = utc_now()
        with self._lock:
            for session in self._sessions.values():
                if now > session.expires_at and session.status != SessionPhase.EXPIRED:
                    session.status = SessionPhase.EXPIRED
                    session.phase = SessionPhase.EXPIRED
                    session.updated_at = now

    def _get_active(self, session_id: str, *, allow_expired_state: bool = False) -> Session:
        try:
            session = self._sessions[session_id]
        except KeyError as exc:
            raise BackendError(ErrorCode.SESSION_NOT_FOUND, "The session was not found.", status_code=404) from exc
        if utc_now() > session.expires_at and session.status != SessionPhase.EXPIRED:
            session.status = SessionPhase.EXPIRED
            session.phase = SessionPhase.EXPIRED
            session.updated_at = utc_now()
        if session.status == SessionPhase.EXPIRED and not allow_expired_state:
            raise BackendError(ErrorCode.SESSION_EXPIRED, "The session has expired.", status_code=409)
        return session

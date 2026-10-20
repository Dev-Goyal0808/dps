"""Temporary result storage with a verified-only plaintext boundary."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.utils.errors import BackendError, ErrorCode


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ResultRecord:
    message_id: str
    session_id: str
    recovery_status: str = "processing"
    message: str | None = None
    image_bytes: bytes | None = None
    metrics: dict[str, object] = field(default_factory=dict)
    error: dict[str, str] | None = None
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)


class ResultStore:
    def __init__(self) -> None:
        self._results: dict[str, ResultRecord] = {}
        self._lock = threading.RLock()

    def create(self, session_id: str, message_id: uuid.UUID) -> ResultRecord:
        record = ResultRecord(str(message_id), session_id)
        with self._lock:
            self._results[record.message_id] = record
        return record

    def get(self, message_id: str) -> ResultRecord:
        with self._lock:
            try:
                return self._results[message_id]
            except KeyError as exc:
                raise BackendError(ErrorCode.SESSION_NOT_FOUND, "The message was not found.", status_code=404) from exc

    def mark_verified(self, message_id: str, message: str, image_bytes: bytes) -> None:
        with self._lock:
            record = self.get(message_id)
            record.recovery_status = "verified"
            record.message = message
            record.image_bytes = image_bytes
            record.error = None
            record.updated_at = _now()

    def mark_rejected(self, message_id: str, code: str, message: str) -> None:
        with self._lock:
            record = self.get(message_id)
            record.recovery_status = "rejected"
            record.message = None
            record.image_bytes = None
            record.error = {"code": code, "message": message}
            record.metrics["recovery_status"] = "rejected"
            record.updated_at = _now()

    def mark_failed(self, message_id: str, code: str, message: str) -> None:
        with self._lock:
            record = self.get(message_id)
            record.recovery_status = "failed"
            record.message = None
            record.image_bytes = None
            record.error = {"code": code, "message": message}
            record.metrics["recovery_status"] = "failed"
            record.updated_at = _now()

    def update_metrics(self, message_id: str, metrics: dict[str, object]) -> None:
        with self._lock:
            record = self.get(message_id)
            record.metrics.update(metrics)
            record.updated_at = _now()

    def require_ready(self, message_id: str) -> ResultRecord:
        record = self.get(message_id)
        if record.recovery_status == "processing":
            raise BackendError(ErrorCode.RESULT_NOT_READY, "The message result is not ready.", status_code=409)
        return record

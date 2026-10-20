"""Security helpers that do not expose secret values."""

from __future__ import annotations

import hashlib
import hmac
import secrets


def hash_token(token: str) -> bytes:
    """Hash an in-memory bearer token before storing it in a session."""

    return hashlib.sha256(token.encode("utf-8")).digest()


def token_matches(token: str, expected_hash: bytes) -> bool:
    return hmac.compare_digest(hash_token(token), expected_hash)


def random_token() -> str:
    return secrets.token_urlsafe(32)


def random_join_code(length: int = 8) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def constant_time_equal(left: bytes, right: bytes) -> bool:
    return hmac.compare_digest(left, right)

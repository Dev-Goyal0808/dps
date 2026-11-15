"""Validated environment configuration for the backend."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _int_env(name: str, default: int, *, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if value < minimum:
        raise ValueError(f"{name} must be at least {minimum}")
    return value


def _float_env(name: str, default: float, *, minimum: float = 0.01) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number") from exc
    if value < minimum:
        raise ValueError(f"{name} must be at least {minimum}")
    return value


@dataclass(frozen=True)
class Settings:
    app_version: str = "1.0.0"
    tcp_host: str = "127.0.0.1"
    tcp_port: int = 8765
    max_message_bytes: int = 256 * 1024
    max_cover_image_bytes: int = 10 * 1024 * 1024
    max_stego_image_bytes: int = 20 * 1024 * 1024
    max_frame_bytes: int = 20 * 1024 * 1024
    chunk_size: int = 64 * 1024
    session_lifetime_seconds: int = 30 * 60
    join_code_lifetime_seconds: int = 10 * 60
    qim_delta: int = 8
    max_image_width: int = 4096
    max_image_height: int = 4096
    connect_timeout_seconds: float = 5.0
    handshake_timeout_seconds: float = 5.0
    frame_timeout_seconds: float = 10.0
    transfer_timeout_seconds: float = 120.0
    identity_private_key_path: Path | None = None
    trusted_peer_keys: tuple[str, ...] = field(default_factory=tuple)
    cors_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")
    # When set, the built frontend is served by the same process as the API.
    static_dir: Path | None = None

    def __post_init__(self) -> None:
        if self.tcp_port < 0 or self.tcp_port > 65535:
            raise ValueError("tcp_port must be between 0 and 65535")
        if self.max_frame_bytes < 32:
            raise ValueError("max_frame_bytes must leave room for chunk metadata")
        if self.chunk_size + 16 > self.max_frame_bytes:
            raise ValueError("chunk_size cannot exceed max_frame_bytes minus chunk metadata")
        if self.qim_delta < 2 or self.qim_delta % 2:
            raise ValueError("qim_delta must be an even integer of at least 2")
        if self.max_image_width < 1 or self.max_image_height < 1:
            raise ValueError("image dimensions must be positive")

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(
            item.strip()
            for item in os.getenv("STEGOCRYPT_CORS_ORIGINS", "http://localhost:5173").split(",")
            if item.strip()
        )
        key_path = os.getenv("STEGOCRYPT_IDENTITY_PRIVATE_KEY_PATH")
        trusted = tuple(
            item.strip()
            for item in os.getenv("STEGOCRYPT_TRUSTED_PEER_KEYS", "").split(",")
            if item.strip()
        )
        return cls(
            app_version=os.getenv("STEGOCRYPT_VERSION", "1.0.0"),
            tcp_host=os.getenv("STEGOCRYPT_TCP_HOST", "127.0.0.1"),
            tcp_port=_int_env("STEGOCRYPT_TCP_PORT", 8765, minimum=0),
            max_message_bytes=_int_env("STEGOCRYPT_MAX_MESSAGE_BYTES", 256 * 1024),
            max_cover_image_bytes=_int_env("STEGOCRYPT_MAX_COVER_IMAGE_BYTES", 10 * 1024 * 1024),
            max_stego_image_bytes=_int_env("STEGOCRYPT_MAX_STEGO_IMAGE_BYTES", 20 * 1024 * 1024),
            max_frame_bytes=_int_env("STEGOCRYPT_MAX_FRAME_BYTES", 20 * 1024 * 1024),
            chunk_size=_int_env("STEGOCRYPT_TCP_CHUNK_SIZE", 64 * 1024),
            session_lifetime_seconds=_int_env("STEGOCRYPT_SESSION_LIFETIME_SECONDS", 30 * 60),
            join_code_lifetime_seconds=_int_env("STEGOCRYPT_JOIN_CODE_LIFETIME_SECONDS", 10 * 60),
            qim_delta=_int_env("STEGOCRYPT_QIM_DELTA", 8, minimum=2),
            max_image_width=_int_env("STEGOCRYPT_MAX_IMAGE_WIDTH", 4096),
            max_image_height=_int_env("STEGOCRYPT_MAX_IMAGE_HEIGHT", 4096),
            connect_timeout_seconds=_float_env("STEGOCRYPT_CONNECT_TIMEOUT", 5.0),
            handshake_timeout_seconds=_float_env("STEGOCRYPT_HANDSHAKE_TIMEOUT", 5.0),
            frame_timeout_seconds=_float_env("STEGOCRYPT_FRAME_TIMEOUT", 10.0),
            transfer_timeout_seconds=_float_env("STEGOCRYPT_TRANSFER_TIMEOUT", 120.0),
            identity_private_key_path=Path(key_path) if key_path else None,
            trusted_peer_keys=trusted,
            cors_origins=origins,
            static_dir=Path(static_dir) if (static_dir := os.getenv("STEGOCRYPT_STATIC_DIR")) else None,
        )

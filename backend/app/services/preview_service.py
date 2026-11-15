"""Sender-facing preview of the encryption and QIM embedding steps.

The preview runs the same authenticated X25519 handshake, AES-256-GCM
encryption, and QIM embedding as a real transfer, but stops before the TCP
upload. It exposes exactly the bytes that would be hidden in the image so the
sender can inspect the ciphertext and the embedded bitstream on one page.
"""

from __future__ import annotations

import hashlib
import threading
import time
import uuid
import zlib
from dataclasses import dataclass
from itertools import islice

from PIL import Image

from app.config import Settings
from app.crypto.aead import associated_data, encrypt
from app.crypto.identity import IdentityKeyPair, TrustedPeerStore
from app.crypto.key_exchange import InitiatorHandshake, ResponderHandshake
from app.crypto.payload import TAG_LENGTH
from app.steganography.capacity import Capacity, require_capacity
from app.steganography.image_io import LoadedImage, encode_png
from app.steganography.payload_codec import HEADER_SIZE, StegoHeader, encode_container
from app.steganography.qim import bytes_to_bits, embed_payload
from app.utils.errors import BackendError, ErrorCode

PREVIEW_TTL_SECONDS = 600
BIT_DETAIL_LIMIT = 16
BITS_SAMPLE_LIMIT = 96
CONTAINER_HEX_PREVIEW_BYTES = 48


@dataclass(frozen=True)
class StoredPreview:
    session_id: str
    image_bytes: bytes
    expires_at: float


class PreviewStore:
    """Short-lived stego images referenced by id from the preview response."""

    def __init__(self, max_entries: int = 12) -> None:
        self.max_entries = max_entries
        self._items: dict[str, StoredPreview] = {}
        self._lock = threading.RLock()

    def put(self, session_id: str, image_bytes: bytes) -> str:
        preview_id = str(uuid.uuid4())
        now = time.monotonic()
        with self._lock:
            self._purge(now)
            while len(self._items) >= self.max_entries:
                oldest = min(self._items.items(), key=lambda item: item[1].expires_at)[0]
                self._items.pop(oldest, None)
            self._items[preview_id] = StoredPreview(
                session_id=session_id,
                image_bytes=image_bytes,
                expires_at=now + PREVIEW_TTL_SECONDS,
            )
        return preview_id

    def get(self, preview_id: str) -> StoredPreview:
        now = time.monotonic()
        with self._lock:
            self._purge(now)
            try:
                return self._items[preview_id]
            except KeyError as exc:
                raise BackendError(
                    ErrorCode.RESULT_NOT_READY,
                    "The preview image has expired. Type or edit the message to rebuild it.",
                    status_code=404,
                ) from exc

    def _purge(self, now: float) -> None:
        for key in [key for key, item in self._items.items() if item.expires_at <= now]:
            self._items.pop(key, None)


class MessagePreviewService:
    def __init__(
        self,
        settings: Settings,
        identity: IdentityKeyPair,
        trusted_peers: TrustedPeerStore,
        store: PreviewStore,
    ) -> None:
        self.settings = settings
        self.identity = identity
        self.trusted_peers = trusted_peers
        self.store = store

    def negotiate_session_key(self, session_id: str) -> bytes:
        """Run the real signed X25519 exchange in process and return its key."""
        initiator = InitiatorHandshake(self.identity, self.identity.public_bytes, session_id)
        responder = ResponderHandshake(self.identity, self.trusted_peers, session_id)
        client_hello = initiator.client_hello()
        server_hello, server_finished = responder.process_client_hello(client_hello)
        client_finished = initiator.process_server_hello(server_hello)
        initiator.verify_server_finished(server_finished)
        responder.verify_client_finished(client_finished)
        if initiator.result is None:
            raise BackendError(ErrorCode.KEY_EXCHANGE_FAILED, "The preview handshake did not complete.")
        return initiator.result.session_key

    def build(self, session_id: str, message: str, loaded: LoadedImage | None) -> dict[str, object]:
        try:
            plaintext = message.encode("utf-8")
        except UnicodeEncodeError as exc:
            raise BackendError(ErrorCode.INVALID_REQUEST, "The message must be valid UTF-8.") from exc
        if len(plaintext) > self.settings.max_message_bytes:
            raise BackendError(
                ErrorCode.MESSAGE_TOO_LARGE,
                "The message is too large.",
                status_code=413,
                details={"max_bytes": self.settings.max_message_bytes},
            )

        capacity: Capacity | None = None
        if loaded is not None:
            capacity = require_capacity(
                loaded.image.width,
                loaded.image.height,
                len(plaintext) + 51,
                quantizer_id=1,
            )

        message_id = uuid.uuid4()
        session_key = self.negotiate_session_key(session_id)
        encrypted = encrypt(session_key, plaintext, session_id=session_id, message_id=message_id)
        payload = encrypted.serialize()

        ciphertext_body = encrypted.ciphertext[:-TAG_LENGTH]
        encryption_preview: dict[str, object] = {
            "algorithm": "AES-256-GCM",
            "key_exchange": "Ephemeral X25519 with Ed25519 signatures, HKDF-SHA256",
            "key_fingerprint": hashlib.sha256(session_key).hexdigest()[:16],
            "message_id": str(message_id),
            "nonce_hex": encrypted.nonce.hex(),
            "ciphertext_hex": ciphertext_body.hex(),
            "tag_hex": encrypted.ciphertext[-TAG_LENGTH:].hex(),
            "plaintext_bytes": len(plaintext),
            "payload_bytes": len(payload),
            "serialized_payload_hex": payload.hex(),
            "associated_data": associated_data(session_id, message_id).decode("utf-8"),
        }

        response: dict[str, object] = {
            "preview_id": "",
            "session_id": session_id,
            "message_id": str(message_id),
            "encryption": encryption_preview,
            "stego": None,
        }
        if loaded is None or capacity is None:
            return response

        stego_preview, image_bytes = self._embed(session_id, loaded, payload, capacity)
        preview_id = self.store.put(session_id, image_bytes)
        stego_preview["stego_image_url"] = f"/api/messages/preview/{preview_id}/image"
        response["preview_id"] = preview_id
        response["stego"] = stego_preview
        return response

    def _embed(
        self,
        session_id: str,
        loaded: LoadedImage,
        payload: bytes,
        capacity: Capacity,
    ) -> tuple[dict[str, object], bytes]:
        header = StegoHeader.decode(encode_container(payload)[:HEADER_SIZE], max_payload_bytes=len(payload))
        container = encode_container(payload)
        bits = bytes_to_bits(container)
        stego_image: Image.Image = embed_payload(loaded.image, payload, delta=self.settings.qim_delta)
        image_bytes = encode_png(stego_image, max_bytes=self.settings.max_stego_image_bytes)
        placements, modified, mean_delta, max_delta = self._sample_changes(
            loaded.image, stego_image, bits, width=loaded.image.width
        )
        required_bytes = HEADER_SIZE + len(payload)
        stego_preview: dict[str, object] = {
            "image_width": loaded.image.width,
            "image_height": loaded.image.height,
            "qim_delta": self.settings.qim_delta,
            "capacity_bytes": capacity.available_bytes,
            "required_bytes": required_bytes,
            "capacity_utilization": required_bytes * 8 / capacity.available_bits,
            "header_hex": container[:HEADER_SIZE].hex(),
            "header": {
                "magic": "SCQ1",
                "version": header.version,
                "quantizer_id": header.quantizer_id,
                "payload_length": header.payload_length,
                "payload_crc32": zlib.crc32(payload) & 0xFFFFFFFF,
            },
            "container_bytes": len(container),
            "bits_embedded": len(bits),
            "bits_sample": self._format_bits(bits),
            "container_hex_preview": container[:CONTAINER_HEX_PREVIEW_BYTES].hex(),
            "bit_placements": placements,
            "modified_samples": modified,
            "mean_abs_delta": mean_delta,
            "max_abs_delta": max_delta,
            "stego_image_url": "",
        }
        return stego_preview, image_bytes

    @staticmethod
    def _format_bits(bits: list[int]) -> str:
        sample = bits[:BITS_SAMPLE_LIMIT]
        groups = ["".join(str(bit) for bit in sample[offset : offset + 8]) for offset in range(0, len(sample), 8)]
        return " ".join(groups)

    @staticmethod
    def _sample_changes(
        original: Image.Image,
        stego: Image.Image,
        bits: list[int],
        *,
        width: int,
    ) -> tuple[list[dict[str, object]], int, float, int]:
        pixels_needed = (len(bits) + 2) // 3
        before_pixels = list(islice(original.convert("RGB").getdata(), pixels_needed))
        after_pixels = list(islice(stego.convert("RGB").getdata(), pixels_needed))
        placements: list[dict[str, object]] = []
        modified = 0
        total_delta = 0
        max_delta = 0
        bit_index = 0
        for pixel_index, (before, after) in enumerate(zip(before_pixels, after_pixels, strict=False)):
            for channel in range(3):
                if bit_index >= len(bits):
                    break
                original_sample = int(before[channel])
                stego_sample = int(after[channel])
                delta = abs(stego_sample - original_sample)
                if delta:
                    modified += 1
                    total_delta += delta
                    max_delta = max(max_delta, delta)
                if len(placements) < BIT_DETAIL_LIMIT:
                    placements.append(
                        {
                            "index": bit_index,
                            "pixel": f"{pixel_index % width},{pixel_index // width}",
                            "channel": "RGB"[channel],
                            "bit": bits[bit_index],
                            "original": original_sample,
                            "quantized": stego_sample,
                        }
                    )
                bit_index += 1
        mean_delta = total_delta / modified if modified else 0.0
        return placements, modified, round(mean_delta, 2), max_delta

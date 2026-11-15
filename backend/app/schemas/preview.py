"""Schemas for the sender-side encryption and embedding preview."""

from __future__ import annotations

from app.schemas.common import StrictModel


class EncryptionPreview(StrictModel):
    algorithm: str
    key_exchange: str
    key_fingerprint: str
    message_id: str
    nonce_hex: str
    ciphertext_hex: str
    tag_hex: str
    plaintext_bytes: int
    payload_bytes: int
    serialized_payload_hex: str
    associated_data: str


class BitPlacement(StrictModel):
    index: int
    pixel: str
    channel: str
    bit: int
    original: int
    quantized: int


class StegoHeaderPreview(StrictModel):
    magic: str
    version: int
    quantizer_id: int
    payload_length: int
    payload_crc32: int


class StegoPreview(StrictModel):
    image_width: int
    image_height: int
    qim_delta: int
    capacity_bytes: int
    required_bytes: int
    capacity_utilization: float
    header_hex: str
    header: StegoHeaderPreview
    container_bytes: int
    bits_embedded: int
    bits_sample: str
    container_hex_preview: str
    bit_placements: list[BitPlacement]
    modified_samples: int
    mean_abs_delta: float
    max_abs_delta: int
    stego_image_url: str


class MessagePreviewResponse(StrictModel):
    preview_id: str
    session_id: str
    message_id: str
    encryption: EncryptionPreview
    stego: StegoPreview | None = None

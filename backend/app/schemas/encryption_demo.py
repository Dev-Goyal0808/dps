"""Schemas for the encryption-only crypto demonstration endpoint."""

from __future__ import annotations

from pydantic import Field

from app.schemas.common import StrictModel


class EncryptionDemoRequest(StrictModel):
    message: str = Field(min_length=1, description="Non-empty UTF-8 message to encrypt.")


class EncryptionAlgorithmDetails(StrictModel):
    identity: str
    key_exchange: str
    key_derivation: str
    encryption: str
    payload_format: str


class EncryptionDemoResponse(StrictModel):
    message_id: str
    recovery_status: str
    recovered_message: str
    ciphertext: str = Field(description="AES-GCM ciphertext and authentication tag, base64 encoded.")
    serialized_payload: str = Field(description="Serialized EncryptedPayload, base64 encoded.")
    nonce: str = Field(description="AES-GCM nonce, base64 encoded.")
    sender_fingerprint: str
    receiver_fingerprint: str
    transcript_hash: str
    algorithm_details: EncryptionAlgorithmDetails
    payload_bytes: int = Field(description="Serialized encrypted payload size in bytes.")

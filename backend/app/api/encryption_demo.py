"""Encryption-only demonstration endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.schemas.encryption_demo import EncryptionDemoRequest, EncryptionDemoResponse


router = APIRouter()


@router.post("/encryption-demo", response_model=EncryptionDemoResponse)
@router.post("/encryption/demo", response_model=EncryptionDemoResponse, include_in_schema=False)
def encryption_demo(request: Request, body: EncryptionDemoRequest) -> EncryptionDemoResponse:
    result = request.app.state.encryption_demo.encrypt_and_recover(body.message)
    return EncryptionDemoResponse(
        message_id=result.message_id,
        recovery_status=result.recovery_status,
        recovered_message=result.recovered_message,
        ciphertext=result.ciphertext,
        serialized_payload=result.serialized_payload,
        nonce=result.nonce,
        sender_fingerprint=result.sender_fingerprint,
        receiver_fingerprint=result.receiver_fingerprint,
        transcript_hash=result.transcript_hash,
        algorithm_details=result.algorithm_details,
        payload_bytes=result.payload_bytes,
    )

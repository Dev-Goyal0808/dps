"""Encryption-only demonstration endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status

from app.api.dependencies import bearer_token
from app.schemas.encryption_demo import (
    EncryptionChannelResponse,
    EncryptionDemoRequest,
    EncryptionDemoResponse,
    EncryptionReceiveRequest,
    EncryptionReceiveResponse,
    EncryptionSendRequest,
    EncryptionSendResponse,
)


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


@router.post(
    "/encryption/channels",
    response_model=EncryptionChannelResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/encryption/sessions",
    response_model=EncryptionChannelResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_encryption_channel(request: Request) -> EncryptionChannelResponse:
    result = request.app.state.encryption_demo.create_channel()
    return EncryptionChannelResponse(
        session_id=result.session_id,
        sender_token=result.sender_token,
        receiver_token=result.receiver_token,
        expires_at=result.expires_at,
        sender_fingerprint=result.sender_fingerprint,
        receiver_fingerprint=result.receiver_fingerprint,
        transcript_hash=result.transcript_hash,
        algorithm_details=result.algorithm_details,
    )


@router.post(
    "/encryption/channels/{session_id}/send",
    response_model=EncryptionSendResponse,
)
@router.post(
    "/encryption/sessions/{session_id}/send",
    response_model=EncryptionSendResponse,
    include_in_schema=False,
)
def send_encrypted_message(
    request: Request,
    session_id: str,
    body: EncryptionSendRequest,
    token: str = Depends(bearer_token),
) -> EncryptionSendResponse:
    result = request.app.state.encryption_demo.send_message(session_id, token, body.message)
    return EncryptionSendResponse(
        session_id=result.session_id,
        message_id=result.message_id,
        status=result.status,
        ciphertext=result.ciphertext,
        serialized_payload=result.serialized_payload,
        nonce=result.nonce,
        sender_fingerprint=result.sender_fingerprint,
        receiver_fingerprint=result.receiver_fingerprint,
        transcript_hash=result.transcript_hash,
        algorithm_details=result.algorithm_details,
        payload_bytes=result.payload_bytes,
    )


@router.post(
    "/encryption/channels/{session_id}/receive",
    response_model=EncryptionReceiveResponse,
)
@router.post(
    "/encryption/sessions/{session_id}/receive",
    response_model=EncryptionReceiveResponse,
    include_in_schema=False,
)
def receive_encrypted_message(
    request: Request,
    session_id: str,
    body: EncryptionReceiveRequest,
    token: str = Depends(bearer_token),
) -> EncryptionReceiveResponse:
    result = request.app.state.encryption_demo.receive_message(
        session_id,
        token,
        body.message_id,
        body.serialized_payload,
    )
    return EncryptionReceiveResponse(
        session_id=result.session_id,
        message_id=result.message_id,
        recovery_status=result.recovery_status,
        plaintext=result.plaintext,
    )

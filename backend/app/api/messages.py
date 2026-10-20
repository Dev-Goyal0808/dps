"""Message upload, authorized result, and image endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import Response

from app.api.dependencies import bearer_token
from app.schemas.common import ApiError
from app.schemas.messages import MetricsResponse, ResultResponse, SendMessageResponse
from app.steganography.image_io import load_image
from app.utils.errors import BackendError, ErrorCode


router = APIRouter()


@router.post("/messages/send", response_model=SendMessageResponse, status_code=201)
async def send_message(
    request: Request,
    session_id: str = Form(...),
    message: str = Form(...),
    cover_image: UploadFile = File(...),
    token: str = Depends(bearer_token),
) -> SendMessageResponse:
    sessions = request.app.state.sessions
    sessions.authorize(session_id, token, "sender")
    settings = request.app.state.settings
    data = await cover_image.read(settings.max_cover_image_bytes + 1)
    if len(data) > settings.max_cover_image_bytes:
        raise BackendError(
            ErrorCode.IMAGE_TOO_LARGE,
            "The image upload is too large.",
            status_code=413,
            details={"max_bytes": settings.max_cover_image_bytes},
        )
    loaded = load_image(
        data,
        max_bytes=settings.max_cover_image_bytes,
        max_width=settings.max_image_width,
        max_height=settings.max_image_height,
    )
    message_id = request.app.state.workflow.start_send(session_id, message, loaded)
    return SendMessageResponse(message_id=str(message_id), status="processing")


@router.get("/messages/{message_id}/result", response_model=ResultResponse)
async def get_result(request: Request, message_id: str, token: str = Depends(bearer_token)) -> ResultResponse:
    results = request.app.state.results
    record = results.get(message_id)
    _, role = request.app.state.sessions.identify_role(record.session_id, token)
    if role != "receiver":
        raise BackendError(ErrorCode.FORBIDDEN, "Only the receiver can retrieve plaintext.", status_code=403)
    record = results.require_ready(message_id)
    metrics = MetricsResponse.model_validate(record.metrics)
    error = None if record.error is None else ApiError(code=record.error["code"], message=record.error["message"])
    verified = record.recovery_status == "verified"
    return ResultResponse(
        message_id=record.message_id,
        recovery_status=record.recovery_status,
        message=record.message if verified else None,
        received_image_url=f"/api/messages/{record.message_id}/image" if record.image_bytes is not None else None,
        metrics=metrics,
        error=error,
    )


@router.get("/messages/{message_id}/image")
async def get_image(request: Request, message_id: str, token: str = Depends(bearer_token)) -> Response:
    record = request.app.state.results.get(message_id)
    request.app.state.sessions.identify_role(record.session_id, token)
    if record.image_bytes is None:
        raise BackendError(ErrorCode.RESULT_NOT_READY, "The image result is not ready.", status_code=409)
    return Response(
        content=record.image_bytes,
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )

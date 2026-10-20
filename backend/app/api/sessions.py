"""Session creation, pairing, and polling endpoints."""

from fastapi import APIRouter, Depends, Request, status

from app.api.dependencies import bearer_token
from app.schemas.sessions import (
    ConnectSessionRequest,
    ConnectSessionResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    SessionStatusResponse,
)


router = APIRouter()


@router.post("/sessions", response_model=CreateSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(request: Request, body: CreateSessionRequest) -> CreateSessionResponse:
    sessions = request.app.state.sessions
    session, receiver_token, join_code, fingerprint = sessions.create_receiver()
    return CreateSessionResponse(
        session_id=session.session_id,
        receiver_token=receiver_token,
        join_code=join_code,
        expires_at=session.expires_at,
        receiver_fingerprint=fingerprint,
        status=session.status,
    )


@router.post("/sessions/{session_id}/connect", response_model=ConnectSessionResponse)
def connect_session(
    request: Request,
    session_id: str,
    body: ConnectSessionRequest,
) -> ConnectSessionResponse:
    session, sender_token = request.app.state.sessions.connect_sender(session_id, body.join_code)
    return ConnectSessionResponse(session_id=session.session_id, sender_token=sender_token, status=session.status)


@router.get("/sessions/{session_id}/status", response_model=SessionStatusResponse)
async def session_status(
    request: Request,
    session_id: str,
    token: str = Depends(bearer_token),
) -> SessionStatusResponse:
    session, _ = request.app.state.sessions.identify_role(session_id, token)
    error = None
    if session.error is not None:
        from app.schemas.common import ApiError

        error = ApiError(code=str(session.error["code"]), message=str(session.error["message"]))
    return SessionStatusResponse(
        session_id=session.session_id,
        status=session.status,
        phase=session.phase,
        progress=session.progress,
        bytes_sent=session.bytes_sent,
        bytes_total=session.bytes_total,
        message_id=session.message_id,
        error=error,
        updated_at=session.updated_at,
    )

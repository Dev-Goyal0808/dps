"""Authorized evaluation endpoint."""

from fastapi import APIRouter, Depends, Request

from app.api.dependencies import bearer_token
from app.schemas.evaluation import EvaluationRequest
from app.schemas.messages import EvaluationResponse, MetricsResponse
from app.utils.errors import BackendError, ErrorCode


router = APIRouter()


@router.post("/evaluation", response_model=EvaluationResponse)
async def evaluate(
    request: Request,
    body: EvaluationRequest,
    token: str = Depends(bearer_token),
) -> EvaluationResponse:
    record = request.app.state.results.get(body.message_id)
    request.app.state.sessions.identify_role(record.session_id, token)
    record = request.app.state.results.require_ready(body.message_id)
    if record.recovery_status != "verified":
        raise BackendError(ErrorCode.RESULT_NOT_READY, "The completed result is not available.", status_code=409)
    return EvaluationResponse(
        message_id=record.message_id,
        recovery_status=record.recovery_status,
        metrics=MetricsResponse.model_validate(record.metrics),
    )

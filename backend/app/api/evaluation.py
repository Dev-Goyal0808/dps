"""Authorized evaluation endpoint."""

from fastapi import APIRouter, Depends, Request

from app.api.dependencies import bearer_token
from app.schemas.evaluation import EvaluationRequest
from app.schemas.messages import EvaluationResponse, MetricsResponse
from app.utils.errors import BackendError, ErrorCode


router = APIRouter()

# Fields that come from comparing the original image with the received PNG.
IMAGE_COMPARISON_FIELDS = (
    "psnr",
    "ssim",
    "mse",
    "rmse",
    "max_abs_error",
    "changed_samples",
    "total_samples",
    "changed_sample_ratio",
    "mean_abs_error_changed",
    "embedding_rate_bpp",
)


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
    metrics = MetricsResponse.model_validate(record.metrics)
    if not body.include_image_comparison:
        # The caller asked for transport and recovery measurements only, so the
        # image-derived values are omitted instead of being echoed anyway.
        metrics = metrics.model_copy(update={field: None for field in IMAGE_COMPARISON_FIELDS})
    return EvaluationResponse(
        message_id=record.message_id,
        recovery_status=record.recovery_status,
        metrics=metrics,
    )

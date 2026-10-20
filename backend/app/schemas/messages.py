"""Message, result, image, and metric API schemas."""

from __future__ import annotations

from app.schemas.common import ApiError, StrictModel


class SendMessageResponse(StrictModel):
    message_id: str
    status: str


class MetricsResponse(StrictModel):
    payload_bytes: int = 0
    capacity_bytes: int = 0
    capacity_utilization: float = 0.0
    remaining_bytes: int = 0
    psnr: float | None = None
    ssim: float | None = None
    encryption_time_ms: float = 0.0
    embedding_time_ms: float = 0.0
    extraction_time_ms: float = 0.0
    decryption_time_ms: float = 0.0
    transmission_time_ms: float = 0.0
    throughput_bytes_per_second: float = 0.0
    recovery_status: str = "processing"


class ResultResponse(StrictModel):
    message_id: str
    recovery_status: str
    message: str | None = None
    received_image_url: str | None = None
    metrics: MetricsResponse = MetricsResponse()
    error: ApiError | None = None


class EvaluationResponse(StrictModel):
    message_id: str
    recovery_status: str
    metrics: MetricsResponse

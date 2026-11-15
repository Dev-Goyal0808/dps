"""Message, result, image, and metric API schemas."""

from __future__ import annotations

from app.schemas.common import ApiError, StrictModel


class SendMessageResponse(StrictModel):
    message_id: str
    status: str


class MetricsResponse(StrictModel):
    payload_bytes: int = 0
    plaintext_bytes: int = 0
    capacity_bytes: int = 0
    capacity_utilization: float = 0.0
    remaining_bytes: int = 0
    payload_overhead_bytes: int = 0
    ciphertext_entropy_bits_per_byte: float | None = None
    ciphertext_entropy_ceiling_bits_per_byte: float | None = None
    psnr: float | None = None
    ssim: float | None = None
    mse: float | None = None
    rmse: float | None = None
    max_abs_error: int | None = None
    changed_samples: int | None = None
    total_samples: int | None = None
    changed_sample_ratio: float | None = None
    mean_abs_error_changed: float | None = None
    embedding_rate_bpp: float | None = None
    connection_time_ms: float | None = None
    key_exchange_time_ms: float | None = None
    encryption_time_ms: float | None = None
    embedding_time_ms: float | None = None
    extraction_time_ms: float | None = None
    decryption_time_ms: float | None = None
    transmission_time_ms: float | None = None
    workflow_time_ms: float | None = None
    throughput_bytes_per_second: float | None = None
    payload_throughput_bytes_per_second: float | None = None
    plaintext_match: bool | None = None
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

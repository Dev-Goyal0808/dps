"""Evaluation API schemas."""

from __future__ import annotations

from app.schemas.common import StrictModel


class EvaluationRequest(StrictModel):
    message_id: str
    include_image_comparison: bool = True

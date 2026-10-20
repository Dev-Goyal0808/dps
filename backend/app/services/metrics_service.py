"""Measured image, capacity, timing, and transfer metrics."""

from __future__ import annotations

import math
from typing import Any

from PIL import Image


def image_quality(original: Image.Image, stego: Image.Image) -> tuple[float | None, float]:
    left = list(original.convert("RGB").getdata())
    right = list(stego.convert("RGB").getdata())
    if len(left) != len(right) or not left:
        return None, 0.0
    values_left = [float(channel) for pixel in left for channel in pixel]
    values_right = [float(channel) for pixel in right for channel in pixel]
    mse = sum((a - b) ** 2 for a, b in zip(values_left, values_right, strict=True)) / len(values_left)
    psnr = None if mse == 0 else 10.0 * math.log10((255.0 * 255.0) / mse)
    ssim = _global_ssim(values_left, values_right)
    return psnr, ssim


def _global_ssim(left: list[float], right: list[float]) -> float:
    if not left:
        return 0.0
    mean_left = sum(left) / len(left)
    mean_right = sum(right) / len(right)
    variance_left = sum((value - mean_left) ** 2 for value in left) / len(left)
    variance_right = sum((value - mean_right) ** 2 for value in right) / len(right)
    covariance = sum((a - mean_left) * (b - mean_right) for a, b in zip(left, right, strict=True)) / len(left)
    c1 = 6.5025
    c2 = 58.5225
    denominator = (mean_left**2 + mean_right**2 + c1) * (variance_left + variance_right + c2)
    return 1.0 if denominator == 0 else ((2 * mean_left * mean_right + c1) * (2 * covariance + c2)) / denominator


def build_metrics(
    *,
    payload_bytes: int,
    capacity_bytes: int,
    original: Image.Image,
    stego: Image.Image,
    timings: dict[str, float],
) -> dict[str, Any]:
    psnr, ssim = image_quality(original, stego)
    transfer = timings.get("transfer_seconds", 0.0)
    return {
        "payload_bytes": payload_bytes,
        "capacity_bytes": capacity_bytes,
        "capacity_utilization": payload_bytes / capacity_bytes if capacity_bytes else 0.0,
        "remaining_bytes": max(capacity_bytes - payload_bytes, 0),
        "psnr": psnr,
        "ssim": ssim,
        "encryption_time_ms": timings.get("encryption_seconds", 0.0) * 1000,
        "embedding_time_ms": timings.get("embedding_seconds", 0.0) * 1000,
        "transmission_time_ms": transfer * 1000,
        "throughput_bytes_per_second": payload_bytes / transfer if transfer > 0 else 0.0,
    }

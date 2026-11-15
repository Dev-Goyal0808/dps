"""Measured image, capacity, crypto, timing, and transfer metrics.

Every value returned here is computed from the bytes of the current run: the
in-memory cover image, the reloaded stego PNG, the serialized encrypted payload,
and the phase timers. Nothing is estimated from a table or a fixed constant.

The image comparison works over raw 8-bit RGB samples, so it reports how much of
the carrier actually changed. Whole-image SSIM saturates at 1.0 for a small
payload because the vast majority of samples are untouched; the sample-level
values below stay discriminating at any payload size.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass
from typing import Any

from PIL import Image

# Constants of the standard SSIM formula for 8-bit data (Wang et al., 2004).
SSIM_C1 = (0.01 * 255) ** 2
SSIM_C2 = (0.03 * 255) ** 2


@dataclass(frozen=True)
class ImageComparison:
    psnr: float | None
    ssim: float
    mse: float
    rmse: float
    max_abs_error: int
    changed_samples: int
    total_samples: int
    changed_sample_ratio: float
    mean_abs_error_changed: float


def compare_images(original: Image.Image, stego: Image.Image) -> ImageComparison | None:
    left = list(original.convert("RGB").getdata())
    right = list(stego.convert("RGB").getdata())
    if len(left) != len(right) or not left:
        return None
    values_left = [float(channel) for pixel in left for channel in pixel]
    values_right = [float(channel) for pixel in right for channel in pixel]
    squared_error = 0.0
    changed = 0
    total_abs_change = 0.0
    max_delta = 0
    for before, after in zip(values_left, values_right, strict=True):
        difference = before - after
        squared_error += difference * difference
        if difference:
            changed += 1
            magnitude = abs(difference)
            total_abs_change += magnitude
            if magnitude > max_delta:
                max_delta = int(magnitude)
    mse = squared_error / len(values_left)
    rmse = math.sqrt(mse)
    psnr = None if mse == 0 else 10.0 * math.log10((255.0 * 255.0) / mse)
    ssim = _global_ssim(values_left, values_right)
    return ImageComparison(
        psnr=psnr,
        ssim=ssim,
        mse=mse,
        rmse=rmse,
        max_abs_error=max_delta,
        changed_samples=changed,
        total_samples=len(values_left),
        changed_sample_ratio=changed / len(values_left),
        mean_abs_error_changed=total_abs_change / changed if changed else 0.0,
    )


def _global_ssim(left: list[float], right: list[float]) -> float:
    if not left:
        return 0.0
    mean_left = sum(left) / len(left)
    mean_right = sum(right) / len(right)
    variance_left = sum((value - mean_left) ** 2 for value in left) / len(left)
    variance_right = sum((value - mean_right) ** 2 for value in right) / len(right)
    covariance = sum((a - mean_left) * (b - mean_right) for a, b in zip(left, right, strict=True)) / len(left)
    denominator = (mean_left**2 + mean_right**2 + SSIM_C1) * (variance_left + variance_right + SSIM_C2)
    if denominator == 0:
        return 1.0
    return ((2 * mean_left * mean_right + SSIM_C1) * (2 * covariance + SSIM_C2)) / denominator


def shannon_entropy(data: bytes) -> float | None:
    """Shannon entropy of the serialized payload in bits per byte.

    A value near 8.0 means every byte value appears about equally often, which
    is what authenticated ciphertext looks like. The 23-byte SCEP header is
    fixed, so the measured value sits slightly below 8.
    """
    if not data:
        return None
    counts = Counter(data)
    total = len(data)
    return -sum((count / total) * math.log2(count / total) for count in counts.values())


def envelope_metrics(payload: bytes, *, plaintext_bytes: int) -> dict[str, Any]:
    """Sizes and entropy of the exact serialized payload that was embedded."""
    payload_bytes = len(payload)
    entropy = shannon_entropy(payload)
    return {
        "payload_bytes": payload_bytes,
        "plaintext_bytes": plaintext_bytes,
        "payload_overhead_bytes": max(payload_bytes - plaintext_bytes, 0),
        "ciphertext_entropy_bits_per_byte": round(entropy, 4) if entropy is not None else None,
        # Entropy per byte is capped at 8; with only N sampled bytes it is also
        # capped at log2(N), so a short message legitimately reports well below
        # 8 bits/byte. Reporting the bound avoids reading that as weak output.
        "ciphertext_entropy_ceiling_bits_per_byte": (
            round(min(8.0, math.log2(payload_bytes)), 4) if payload_bytes > 1 else None
        ),
    }


def comparison_metrics(
    comparison: ImageComparison,
    *,
    payload_bytes: int,
    pixels: int,
) -> dict[str, Any]:
    """Convert one real image comparison into API fields."""
    return {
        "psnr": comparison.psnr,
        "ssim": round(comparison.ssim, 6),
        "mse": round(comparison.mse, 6),
        "rmse": round(comparison.rmse, 6),
        "max_abs_error": comparison.max_abs_error,
        "changed_samples": comparison.changed_samples,
        "total_samples": comparison.total_samples,
        "changed_sample_ratio": round(comparison.changed_sample_ratio, 8),
        "mean_abs_error_changed": round(comparison.mean_abs_error_changed, 4),
        # Container bits (16-byte SCQ1 header + payload) per image pixel.
        "embedding_rate_bpp": round((payload_bytes + 16) * 8 / pixels, 6) if pixels else 0.0,
    }


def sender_metrics(
    *,
    payload: bytes,
    plaintext_bytes: int,
    capacity_bytes: int,
    timings: dict[str, float],
) -> dict[str, Any]:
    """Sender-side values known once the payload is embedded in the cover image.

    These are published before the image leaves the sender, so the image-quality
    comparison (computed by the receiver from the same in-memory cover) is the
    only value that lands afterwards.
    """
    payload_bytes = len(payload)
    return {
        "capacity_bytes": capacity_bytes,
        "capacity_utilization": payload_bytes / capacity_bytes if capacity_bytes else 0.0,
        "remaining_bytes": max(capacity_bytes - payload_bytes, 0),
        "connection_time_ms": timings.get("connection_seconds", 0.0) * 1000,
        "key_exchange_time_ms": timings.get("handshake_seconds", 0.0) * 1000,
        "encryption_time_ms": timings.get("encryption_seconds", 0.0) * 1000,
        "embedding_time_ms": timings.get("embedding_seconds", 0.0) * 1000,
        **envelope_metrics(payload, plaintext_bytes=plaintext_bytes),
    }

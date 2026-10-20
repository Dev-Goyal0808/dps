"""Pillow image validation and PNG output."""

from __future__ import annotations

import io
import warnings
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

from app.utils.errors import BackendError, ErrorCode


@dataclass(frozen=True)
class LoadedImage:
    image: Image.Image
    source_bytes: bytes


def load_image(
    data: bytes,
    *,
    max_bytes: int,
    max_width: int,
    max_height: int,
) -> LoadedImage:
    if len(data) > max_bytes:
        raise BackendError(
            ErrorCode.IMAGE_TOO_LARGE,
            "The image upload is too large.",
            status_code=413,
            details={"max_bytes": max_bytes},
        )
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                source.verify()
            with Image.open(io.BytesIO(data)) as source:
                width, height = source.size
                if width < 1 or height < 1 or width > max_width or height > max_height:
                    raise BackendError(
                        ErrorCode.INVALID_IMAGE,
                        "The image dimensions are not supported.",
                        details={"max_width": max_width, "max_height": max_height},
                    )
                image = source.convert("RGB")
                image.load()
    except BackendError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise BackendError(ErrorCode.INVALID_IMAGE, "The uploaded file is not a valid image.") from exc
    return LoadedImage(image, data)


def encode_png(image: Image.Image, *, max_bytes: int) -> bytes:
    output = io.BytesIO()
    image.convert("RGB").save(output, format="PNG", optimize=False)
    encoded = output.getvalue()
    if len(encoded) > max_bytes:
        raise BackendError(
            ErrorCode.IMAGE_TOO_LARGE,
            "The generated image is too large.",
            status_code=413,
            details={"max_bytes": max_bytes},
        )
    try:
        with Image.open(io.BytesIO(encoded)) as reopened:
            reopened.verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise BackendError(ErrorCode.INVALID_IMAGE, "The generated PNG could not be validated.") from exc
    return encoded

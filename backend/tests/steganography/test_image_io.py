from __future__ import annotations

import io

import pytest
from PIL import Image

from app.steganography.image_io import encode_png, load_image
from app.utils.errors import BackendError


def test_image_validation_converts_alpha_to_rgb_and_reopens_png() -> None:
    source = io.BytesIO()
    Image.new("RGBA", (32, 32), (1, 2, 3, 120)).save(source, format="PNG")
    loaded = load_image(source.getvalue(), max_bytes=1024 * 1024, max_width=64, max_height=64)
    assert loaded.image.mode == "RGB"
    output = encode_png(loaded.image, max_bytes=1024 * 1024)
    reopened = load_image(output, max_bytes=1024 * 1024, max_width=64, max_height=64)
    assert reopened.image.size == (32, 32)


def test_invalid_image_is_rejected() -> None:
    with pytest.raises(BackendError) as error:
        load_image(b"not an image", max_bytes=100, max_width=64, max_height=64)
    assert error.value.code == "INVALID_IMAGE"

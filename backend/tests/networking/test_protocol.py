from __future__ import annotations

import uuid

import pytest

from app.networking.protocol import ImageChunk, TransferMetadata, image_digest
from app.utils.errors import BackendError


def test_transfer_metadata_and_chunk_boundaries_are_validated() -> None:
    image = b"image bytes"
    metadata = TransferMetadata(uuid.uuid4(), len(image), image_digest(image), 4, 3)
    assert TransferMetadata.decode(metadata.encode(), max_image_bytes=100, max_chunk_count=100) == metadata
    chunk = ImageChunk(0, 0, b"abcd")
    assert ImageChunk.decode(chunk.encode()) == chunk
    with pytest.raises(BackendError):
        TransferMetadata.decode(
            TransferMetadata(metadata.message_id, len(image), metadata.image_sha256, 4, 2).encode(),
            max_image_bytes=100,
            max_chunk_count=100,
        )

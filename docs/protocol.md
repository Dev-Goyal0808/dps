# StegoCrypt Protocol Specification

## 1. Protocol layers

StegoCrypt has three separate protocol layers:

```text
Application API protocol
  HTTP/JSON and multipart requests between browser and FastAPI

Endpoint handshake protocol
  Authenticated X25519/Ed25519 exchange over TCP

Image transfer protocol
  Length-framed PNG metadata and chunks over TCP
```

The encrypted text is carried inside the image. The TCP layer transfers image bytes and does not need to understand plaintext.

## 2. TCP frame format

Every frame is encoded as:

```text
┌──────────────────────────┬───────────┬─────────────────────┐
│ length: uint32 big-endian│ type: u8  │ body: variable      │
└──────────────────────────┴───────────┴─────────────────────┘
```

`length` counts the type byte plus body bytes. It does not count the four-byte length field itself.

The receiver must reject:

- A length larger than `MAX_FRAME_BYTES`.
- A length that cannot be represented safely.
- Unknown frame types.
- Truncated frames.
- Frames that arrive after the transfer has ended.

## 3. Frame types

| Value | Name | Purpose |
| ---: | --- | --- |
| `0x01` | `CLIENT_HELLO` | Sender identity and ephemeral key. |
| `0x02` | `SERVER_HELLO` | Receiver identity and ephemeral key. |
| `0x03` | `HANDSHAKE_FINISHED` | Confirms transcript authentication. |
| `0x04` | `TRANSFER_METADATA` | Message ID, image size, digest, and chunk settings. |
| `0x05` | `IMAGE_CHUNK` | A numbered portion of the PNG. |
| `0x06` | `TRANSFER_COMPLETE` | Indicates that all chunks were sent. |
| `0x07` | `ERROR` | Safe protocol-level failure. |

## 4. Handshake messages

The handshake uses canonical serialization. The implementation should use a deterministic encoding such as length-delimited JSON or a documented binary structure, and both sides must sign the exact same bytes.

### Client hello

Contains:

- Protocol version.
- Session ID.
- Sender identity Ed25519 public key.
- Sender ephemeral X25519 public key.
- Random handshake nonce.
- Sender signature.

The signature covers all fields except the signature itself and binds the sender role.

### Server hello

Contains:

- Protocol version.
- Session ID.
- Receiver identity Ed25519 public key.
- Receiver ephemeral X25519 public key.
- Echoed handshake nonce.
- Receiver signature over the client and server hello transcript.

The receiver verifies the sender public key against its trusted peer configuration. The sender performs the equivalent check for the receiver.

### Finished message

After both parties calculate the shared secret, they derive a transcript-bound finished key and exchange a short confirmation authenticator. This detects transcript disagreement before image transfer begins.

## 5. Transfer metadata

Transfer metadata contains:

```text
message_id       UUID
image_length     uint64
image_sha256     32 bytes
chunk_size       uint32
chunk_count      uint32
```

The receiver checks all values before accepting image chunks.

## 6. Image chunk

Each image chunk contains:

```text
sequence_number  uint32
offset           uint64
chunk_length     uint32
chunk_bytes      variable
```

The receiver requires:

- Sequence numbers to start at zero.
- Offsets to be contiguous.
- Chunk lengths to match the actual body length.
- Total received bytes to equal `image_length`.
- Total bytes to stay below configured limits.

## 7. Transfer completion

After the final chunk, the sender sends `TRANSFER_COMPLETE`. The receiver calculates SHA-256 over the reconstructed bytes and compares it to the metadata digest.

Only a matching digest allows the image to enter QIM extraction.

## 8. Timeout behavior

The networking implementation will use separate limits for:

- Connection establishment.
- Handshake completion.
- Individual frame reads.
- Whole image transfer.
- Idle connection duration.

Timeouts produce `TRANSFER_FAILED` or `RECEIVER_UNAVAILABLE` at the API layer without exposing socket tracebacks to the browser.

## 9. Protocol versioning

Every handshake and payload includes a version. Unsupported versions must be rejected explicitly rather than interpreted as the closest known version.

## 10. Protocol non-goals

The first version does not claim robustness against:

- Image resizing.
- JPEG recompression.
- Cropping.
- Reordering of image channels.
- Arbitrary proxy transformations.

The TCP protocol protects complete transfer and ordering. It does not turn QIM into a transformation-resistant watermark.

# StegoCrypt Networking Design

## 1. Responsibility

The networking layer is a dedicated Python module. It is responsible for moving bytes between endpoints and reporting transport state. It is not responsible for browser rendering, plaintext display, or cryptographic primitive implementation.

The browser communicates with FastAPI over HTTP. Python owns all sender-to-receiver TCP communication.

## 2. Components

### `framing.py`

Provides:

- Four-byte big-endian length prefixes.
- Maximum frame validation.
- Exact reads when `recv()` returns partial data.
- Complete writes using `sendall()` or an equivalent loop.
- Frame decoding and malformed-frame errors.

### `protocol.py`

Defines:

- Protocol version.
- Frame type identifiers.
- Handshake message schemas.
- Transfer metadata.
- Image chunk metadata.
- Safe protocol errors.

### `tcp_client.py`

Provides sender-side behavior:

- Connect to the receiver host and port.
- Apply connection and transfer timeouts.
- Perform the authenticated handshake.
- Send transfer metadata.
- Send numbered image chunks.
- Send completion frame.
- Report progress to the workflow service.

### `tcp_server.py`

Provides receiver-side behavior:

- Bind to configured host and port.
- Accept connections.
- Apply per-connection limits.
- Perform the authenticated handshake.
- Validate transfer metadata.
- Receive and reconstruct image chunks.
- Verify the final image digest.
- Close resources on success, failure, or timeout.

## 3. Framing rules

```text
4 bytes: frame length, unsigned big-endian
1 byte:  frame type
N bytes: frame body
```

The declared frame length includes the type byte but excludes the length prefix.

The receiver must not allocate based on an unchecked length. It first compares the declared length to `MAX_FRAME_BYTES`.

## 4. Partial reads and writes

TCP is a byte stream. One call to `recv()` is not guaranteed to return one complete frame, and one call to `send()` is not guaranteed to write all bytes.

The implementation must:

- Loop until the requested header bytes are received.
- Decode the length only after the complete prefix arrives.
- Loop until the complete frame body arrives.
- Treat an empty read before completion as a disconnect.
- Use a complete-write helper for outgoing bytes.

This behavior will be tested using deliberately fragmented socket reads.

## 5. Transfer sequence

```text
CONNECT
  │
  ▼
CLIENT_HELLO
  │
  ▼
SERVER_HELLO
  │
  ▼
HANDSHAKE_FINISHED
  │
  ▼
TRANSFER_METADATA
  │
  ▼
IMAGE_CHUNK 0 ... IMAGE_CHUNK N
  │
  ▼
TRANSFER_COMPLETE
  │
  ▼
receiver validates digest and processes image
```

## 6. Transfer validation

The receiver validates:

- Protocol version.
- Session ID.
- Peer identity.
- Image length.
- Maximum image size.
- Chunk size.
- Chunk sequence.
- Chunk offset.
- Total byte count.
- Final SHA-256 digest.

Only an image that passes all transport checks is passed to QIM extraction.

## 7. Timeouts and cleanup

The networking implementation will configure:

- Connect timeout.
- Handshake timeout.
- Frame read timeout.
- Overall transfer timeout.
- Idle connection timeout.

On timeout or disconnect:

1. Close the socket.
2. Remove incomplete transfer bytes.
3. Mark the session as failed.
4. Store a safe error code.
5. Do not return partial plaintext or partial result data.

## 8. Resource limits

The layer will enforce:

- Maximum frame size.
- Maximum image size.
- Maximum chunk count.
- Maximum concurrent transfers per session.
- Maximum transfer duration.

These limits protect against malformed or intentionally oversized input.

## 9. Localhost and LAN behavior

For localhost development, the receiver may bind to `127.0.0.1`.

For LAN demonstrations, the receiver must bind to a reachable interface such as `0.0.0.0`, and the sender must use the receiver's LAN address. Firewalls must allow the configured TCP port.

The documentation must not instruct users to expose the service to the public internet.

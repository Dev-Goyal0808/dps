# StegoCrypt API Specification

## 1. API conventions

Base path:

```text
/api
```

Content types:

- `application/json` for structured requests and responses.
- `multipart/form-data` for message and image uploads.

Authentication:

```http
Authorization: Bearer <temporary-session-token>
```

Tokens are short-lived, role-specific, and never written to logs. The sender token cannot retrieve receiver plaintext, and the receiver token cannot submit a sender message unless explicitly permitted by the session state.

## 2. Common response and error formats

Successful responses use endpoint-specific schemas. Errors use:

```json
{
  "error": {
    "code": "INSUFFICIENT_CAPACITY",
    "message": "The selected image cannot contain this payload.",
    "details": {
      "required_bytes": 12500,
      "available_bytes": 8000
    }
  }
}
```

The `details` object must contain only safe operational information. It must never include keys, plaintext, ciphertext, or bearer tokens.

## 3. Health

### `GET /api/health`

Checks backend availability and TCP listener state.

Response:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "tcp_listener": "ready"
}
```

Possible status codes:

- `200` service is available.
- `503` a required backend service is unavailable.

## 4. Encryption-only demo

### `POST /api/encryption-demo`

Runs one complete authenticated encryption exchange without image processing or TCP transfer. This is the currently available hosted slice of the application.

The backend creates fresh in-memory sender and receiver identities for the request, performs the signed X25519 handshake, derives a session key with HKDF-SHA256, encrypts the message with AES-256-GCM, serializes the encrypted payload, and decrypts it with the responder-derived key before returning the verified result.

Request:

```json
{
  "message": "hello from the encryption lab"
}
```

Response:

```json
{
  "message_id": "uuid",
  "recovery_status": "verified",
  "recovered_message": "hello from the encryption lab",
  "ciphertext": "base64-ciphertext-plus-authentication-tag",
  "serialized_payload": "base64-encrypted-payload",
  "nonce": "base64-12-byte-nonce",
  "sender_fingerprint": "sha256:fingerprint",
  "receiver_fingerprint": "sha256:fingerprint",
  "transcript_hash": "sha256-transcript-hash-hex",
  "algorithm_details": {
    "identity": "Ed25519",
    "key_exchange": "X25519",
    "key_derivation": "HKDF-SHA256",
    "encryption": "AES-256-GCM",
    "payload_format": "EncryptedPayload v1"
  },
  "payload_bytes": 128
}
```

The response intentionally does not include private keys or derived session keys. The endpoint is a cryptographic inspection/demo endpoint, not a durable message store.

## 5. Create receiver session

### `POST /api/sessions`

Creates a receiver session and starts or reserves the configured TCP listener.

Request:

```json
{
  "role": "receiver"
}
```

Response:

```json
{
  "session_id": "7c6b9db0-0d9f-4bb5-9e03-c54820f09c1f",
  "receiver_token": "temporary-token-returned-once",
  "join_code": "B7K4M2Q9",
  "expires_at": "2026-10-20T12:30:00Z",
  "receiver_fingerprint": "sha256:ab12cd34ef56...",
  "status": "waiting"
}
```

The frontend keeps the receiver token in memory. It should not persist it in local storage by default.

## 6. Connect sender

### `POST /api/sessions/{session_id}/connect`

Pairs a sender with a waiting receiver session.

Request:

```json
{
  "join_code": "B7K4M2Q9"
}
```

Response:

```json
{
  "session_id": "7c6b9db0-0d9f-4bb5-9e03-c54820f09c1f",
  "sender_token": "temporary-token-returned-once",
  "status": "connected"
}
```

Security behavior:

- Join codes expire.
- Failed join attempts are limited.
- A successful join code is consumed.
- The session ID alone is not sufficient authorization.

## 7. Session status

### `GET /api/sessions/{session_id}/status`

Returns safe progress information for an authorized session participant.

Response:

```json
{
  "session_id": "7c6b9db0-0d9f-4bb5-9e03-c54820f09c1f",
  "status": "transferring",
  "phase": "transferring",
  "progress": 0.65,
  "bytes_sent": 65536,
  "bytes_total": 100000,
  "message_id": "4f744d8d-df90-4e99-9ec8-72acb2f7f7f7",
  "error": null,
  "updated_at": "2026-10-20T12:04:22Z"
}
```

Possible phases:

```text
waiting
pairing
connected
validating
encrypting
embedding
transferring
extracting
verifying
completed
rejected
failed
expired
```

## 8. Send message

### `POST /api/messages/send`

Requires the sender token and `multipart/form-data`.

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `session_id` | string | yes | Authorized connected session. |
| `message` | string | yes | Plaintext message before encryption. |
| `cover_image` | file | yes | Valid image input. |

Response:

```json
{
  "message_id": "4f744d8d-df90-4e99-9ec8-72acb2f7f7f7",
  "status": "processing"
}
```

Validation includes:

- UTF-8 text validation.
- Maximum message length.
- Upload size limit.
- Pillow image decoding rather than trusting the filename.
- Maximum width and height.
- Session role and state.
- Available QIM capacity.

## 9. Retrieve result

### `GET /api/messages/{message_id}/result`

Requires receiver authorization.

Verified response:

```json
{
  "message_id": "4f744d8d-df90-4e99-9ec8-72acb2f7f7f7",
  "recovery_status": "verified",
  "message": "Recovered plaintext",
  "received_image_url": "/api/messages/4f744d8d-df90-4e99-9ec8-72acb2f7f7f7/image",
  "metrics": {
    "payload_bytes": 128,
    "capacity_bytes": 100000,
    "capacity_utilization": 0.00128,
    "psnr": 41.32,
    "ssim": 0.992,
    "encryption_time_ms": 1.2,
    "embedding_time_ms": 16.4,
    "extraction_time_ms": 15.9,
    "decryption_time_ms": 0.8,
    "transmission_time_ms": 34.2,
    "throughput_bytes_per_second": 2940000
  }
}
```

Rejected response:

```json
{
  "message_id": "4f744d8d-df90-4e99-9ec8-72acb2f7f7f7",
  "recovery_status": "rejected",
  "message": null,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "The recovered payload could not be authenticated."
  }
}
```

The `message` field must remain `null` for every unverified result.

## 10. Retrieve image

### `GET /api/messages/{message_id}/image`

Returns the generated or received PNG only to an authorized session participant.

The response must include:

```http
Content-Type: image/png
Cache-Control: no-store
```

## 11. Evaluation

### `POST /api/evaluation`

Runs evaluation for an authorized completed message.

Request:

```json
{
  "message_id": "4f744d8d-df90-4e99-9ec8-72acb2f7f7f7",
  "include_image_comparison": true
}
```

Response includes:

- PSNR.
- SSIM.
- Payload size.
- Available capacity.
- Capacity utilization.
- Processing timings.
- Network timing and throughput.
- Recovery status.

## 12. HTTP status mapping

| Status | Meaning |
| ---: | --- |
| `200` | Successful read or evaluation. |
| `201` | Session or message created. |
| `400` | Malformed request or invalid input. |
| `401` | Missing or invalid bearer token. |
| `403` | Valid token but wrong role or forbidden operation. |
| `404` | Session or result not found. |
| `409` | Invalid session state or already-consumed pairing. |
| `413` | Request, image, payload, or frame is too large. |
| `422` | Schema validation failure. |
| `503` | Receiver unavailable or TCP service not ready. |

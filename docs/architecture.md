# StegoCrypt Architecture

## 1. Overview

StegoCrypt uses a browser frontend, a FastAPI orchestration layer, modular security and image-processing modules, and a dedicated Python TCP networking layer.

```text
┌───────────────────────────────────────────────────────────┐
│ React + TypeScript frontend                               │
│ Home │ Send │ Receive │ Analysis │ About                  │
└───────────────────────────────┬───────────────────────────┘
                                │ HTTP/JSON + multipart
┌───────────────────────────────▼───────────────────────────┐
│ FastAPI application                                       │
│ routes │ schemas │ auth dependencies │ error handling     │
└──────────────┬────────────────┬──────────────────┬────────┘
               │                │                  │
┌──────────────▼───────┐ ┌──────▼─────────────┐ ┌──▼──────────────┐
│ Session/workflow      │ │ Security           │ │ Steganography   │
│ service               │ │ X25519/Ed25519    │ │ image/QIM       │
│ status/results        │ │ HKDF/AES-GCM      │ │ payload codec   │
└──────────────┬────────┘ └──────┬─────────────┘ └──┬──────────────┘
               │                 │                  │
               └─────────────────┴──────────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │ TCP networking              │
                 │ framing │ client │ server   │
                 └─────────────────────────────┘
```

## 2. Runtime topology

### Single-machine demonstration

The simplest demonstration runs one backend process and one frontend process:

```text
Browser sender ──HTTP──┐
                       ├── FastAPI backend ──TCP loopback── receiver workflow
Browser receiver ─HTTP─┘
```

This mode is useful for development and automated integration tests.

### Two-machine LAN demonstration

For a LAN demonstration, each endpoint can run a backend instance:

```text
Sender browser ─HTTP─ Sender FastAPI ──TCP/LAN── Receiver FastAPI ─HTTP─ Receiver browser
```

The receiver must be reachable on the configured TCP port, and the endpoint identity public keys must be trusted before the connection begins.

## 3. Request-to-result flow

### Receiver setup

1. The receiver calls `POST /api/sessions`.
2. The session manager creates a random session ID.
3. The backend creates a short-lived join code.
4. The backend returns a receiver bearer token and receiver identity fingerprint.
5. The receiver UI begins polling session status.

### Sender connection

1. The sender enters the session ID and join code.
2. The sender calls `POST /api/sessions/{id}/connect`.
3. The session manager validates the join code and expiration.
4. The backend returns a sender bearer token.
5. The session becomes ready for one message transfer.

### Message transfer

1. The sender uploads a text message and cover image.
2. The API validates content type, image dimensions, message length, and session authorization.
3. The workflow service asks the networking layer to establish a TCP connection.
4. The endpoints authenticate identity keys and derive a session key.
5. The crypto service encrypts the message.
6. The steganography service embeds the encrypted payload.
7. The networking service transfers the PNG using framed chunks.
8. The receiver validates the transfer digest.
9. The receiver extracts the stego payload.
10. The receiver verifies the CRC and AES-GCM tag.
11. The result store records verified plaintext for receiver-authorized access.
12. The receiver UI displays the message and metrics.

## 4. Data ownership

| Data | Owner | Exposure |
| --- | --- | --- |
| Session ID | Session manager | Browser and status API. |
| Join code | Receiver UI and sender pairing step | Short-lived, never logged. |
| Bearer token | Browser and backend memory | Returned only at session creation/connection. |
| Identity public key | Security layer | Fingerprint may be displayed. |
| Identity private key | Local backend key store | Never exposed through API. |
| X25519 ephemeral private key | One handshake in memory | Never persisted or returned. |
| AES-GCM key | One workflow in memory | Never logged or returned. |
| Plaintext | Sender request and verified receiver result | Never included in status responses or logs. |
| Stego PNG | Transfer workflow and authorized result | Access controlled by session token. |
| Metrics | Result store | Non-sensitive operational data. |

## 5. Backend service boundaries

### API routes

Routes should be thin. They validate request shape through Pydantic schemas, resolve authorization dependencies, call a service, and translate known errors into HTTP responses.

### Session manager

The session manager owns:

- Session creation.
- Sender pairing.
- Role-specific authorization.
- Join-code expiration.
- Session state transitions.
- Progress snapshots.
- Session cleanup.

### Workflow service

The workflow service coordinates encryption, embedding, TCP transfer, extraction, decryption, metrics, and result storage. It should not duplicate low-level crypto or image logic.

### Result store

The result store keeps temporary authorized results and metrics. It must distinguish between:

- A transfer that completed.
- A payload that extracted.
- A message that passed authentication.

Only the last state permits plaintext access.

## 6. State machine

```text
WAITING
  │ receiver creates session
  ▼
PAIRING
  │ sender supplies valid join code
  ▼
CONNECTED
  │ sender starts upload
  ▼
VALIDATING
  │ valid message and image
  ▼
ENCRYPTING
  ▼
EMBEDDING
  ▼
TRANSFERRING
  ▼
EXTRACTING
  ▼
VERIFYING
  ├── authentication success ──► COMPLETED
  └── authentication failure ──► REJECTED

Any active state can transition to FAILED on timeout, disconnect, validation error, or capacity error.
```

## 7. Error boundary rules

The backend will expose stable error codes rather than implementation tracebacks:

- `INVALID_REQUEST`
- `UNAUTHORIZED`
- `SESSION_NOT_FOUND`
- `SESSION_EXPIRED`
- `JOIN_CODE_INVALID`
- `INVALID_IMAGE`
- `IMAGE_TOO_LARGE`
- `MESSAGE_TOO_LARGE`
- `INSUFFICIENT_CAPACITY`
- `KEY_EXCHANGE_FAILED`
- `RECEIVER_UNAVAILABLE`
- `TRANSFER_FAILED`
- `INVALID_STEGO_PAYLOAD`
- `AUTHENTICATION_FAILED`
- `RESULT_NOT_READY`

Detailed tracebacks are for server logs only, and logs must not include secrets or message contents.

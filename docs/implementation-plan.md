# StegoCrypt Implementation Plan

## 1. Purpose

This document defines the implementation plan for StegoCrypt. It is intentionally written before application code so that the frontend, API, cryptography, steganography, networking, and evaluation work remain modular.

The project should demonstrate a real end-to-end flow rather than a simulated encryption or fake transfer:

```text
text message
    │
    ▼
AES-256-GCM encryption
    │
    ▼
encrypted binary payload
    │
    ▼
QIM embedding into cover image
    │
    ▼
PNG stego image
    │
    ▼
length-framed TCP transfer
    │
    ▼
QIM extraction
    │
    ▼
AES-GCM verification and decryption
    │
    ▼
verified plaintext
```

## 2. Project goals

The completed application must:

- Provide a usable React and TypeScript interface.
- Provide a modular FastAPI backend.
- Establish an authenticated shared secret between endpoints.
- Use HKDF to derive an AES-256-GCM encryption key.
- Encrypt text before embedding it into an image.
- Use a real QIM implementation for embedding and extraction.
- Transfer the generated PNG through Python TCP sockets.
- Validate payload sizes, image formats, framing, and authentication.
- Display recovered plaintext only after successful AES-GCM verification.
- Measure and display image and communication performance.
- Include automated tests for each important layer.
- Clearly document incomplete features and security limitations.

## 3. Scope assumptions

The initial implementation will use the following low-risk assumptions:

1. The application is a college-level local or LAN demonstration.
2. There is no account system, password database, or unrelated user-management feature.
3. Session state is held in memory and expires automatically.
4. The browser communicates with FastAPI using HTTP and multipart uploads.
5. TCP communication is performed only by Python.
6. PNG is the output format because it avoids lossy compression.
7. Identity public keys are trusted through local configuration and displayed fingerprints.
8. A receiver starts a session before a sender connects.
9. Status updates initially use HTTP polling; a WebSocket event stream may be added later.
10. Maximum image, frame, and message sizes are explicit configuration values.

## 4. Layer boundaries

### Frontend

Owns user interaction, page navigation, image selection, status polling, previews, error presentation, and metric presentation.

It must not:

- Perform cryptographic operations.
- Receive private keys.
- Open TCP sockets.
- Display a plaintext result before the backend reports verified recovery.

### API backend

Owns request validation, session authorization, workflow coordination, temporary result access, and safe status reporting.

It must not place cryptographic implementation details inside route handlers. Routes call services, and services call the crypto, steganography, and networking modules.

### Security layer

Owns identity key handling, authenticated key exchange, HKDF, AES-GCM, and encrypted payload serialization.

### Steganography layer

Owns image loading, RGB conversion, capacity calculation, QIM embedding, QIM extraction, stego headers, and payload validation.

### Networking layer

Owns TCP sockets, length-prefixed frames, timeouts, exact reads, chunking, transfer digests, and connection failures.

## 5. Security requirements

- Plain Diffie-Hellman without authentication is not acceptable.
- X25519 ephemeral keys must be authenticated with trusted Ed25519 identity keys.
- AES-GCM nonces must be freshly generated for each message under a given key.
- AES-GCM tags must be verified before plaintext is accepted.
- Private keys, shared secrets, AES keys, bearer tokens, plaintext, and ciphertext must not be written to logs.
- Payload and frame lengths must be validated before allocation or processing.
- The backend must use an explicit CORS allowlist.
- Invalid image, payload, signature, session, and authentication conditions must produce safe structured errors.

## 6. Capacity and size defaults

Initial defaults will be configurable through environment variables:

| Setting | Initial value | Purpose |
| --- | ---: | --- |
| Maximum message size | 256 KiB | Prevent unbounded text input. |
| Maximum cover image upload | 10 MiB | Limit request size. |
| Maximum stego image | 20 MiB | Limit generated and transferred files. |
| Maximum TCP frame | 20 MiB | Protect the framing layer. |
| TCP image chunk | 64 KiB | Provide progress updates. |
| Session lifetime | 30 minutes | Remove abandoned sessions. |
| Join-code lifetime | 10 minutes | Reduce exposure of pairing codes. |
| QIM delta | 8 | Initial quality/capacity trade-off. |

The values are implementation defaults, not security guarantees. They must be validated again on the backend even if the frontend also limits input.

## 7. Completion criteria

The prototype is complete when:

- A receiver can create a session.
- A sender can join the session using a short-lived code.
- A valid authenticated handshake completes.
- A message can be encrypted and embedded.
- A PNG can be transferred over TCP.
- The receiver extracts and authenticates the payload.
- Verified plaintext is displayed in the receiver UI.
- Tampering causes recovery failure rather than plaintext display.
- Capacity errors are clear and actionable.
- Image and transfer metrics are displayed.
- Backend and frontend checks are documented and runnable.

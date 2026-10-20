# StegoCrypt

StegoCrypt is a locally runnable academic web application for secure text communication using:

- React and TypeScript for the browser interface.
- FastAPI and Python for the API backend.
- Authenticated X25519 key exchange and Ed25519 signatures.
- HKDF-SHA256 key derivation.
- AES-256-GCM authenticated encryption.
- Quantization Index Modulation (QIM) image steganography.
- Length-framed TCP socket communication.
- PSNR, SSIM, capacity, timing, throughput, and recovery measurements.

The current hosted slice focuses on the complete encryption path first: authenticated endpoint identities, X25519 key exchange, HKDF key derivation, AES-256-GCM encryption, payload serialization, and verified decryption. Steganography and image transfer remain documented but are intentionally not exposed in the current UI.

## Documentation

The project design is documented before implementation:

| Document | Purpose |
| --- | --- |
| [Implementation plan](docs/implementation-plan.md) | Scope, assumptions, acceptance criteria, and implementation order. |
| [Architecture](docs/architecture.md) | Complete logical architecture and data flow. |
| [File structure](docs/file-structure.md) | Responsibility of every planned source and test file. |
| [API specification](docs/api.md) | REST endpoints, schemas, authorization, and errors. |
| [Protocol specification](docs/protocol.md) | Application payload and TCP framing formats. |
| [Cryptography](docs/cryptography.md) | Authenticated key exchange, HKDF, AES-GCM, and key management. |
| [Steganography](docs/steganography.md) | QIM algorithm, image handling, payload format, and capacity. |
| [Networking](docs/networking.md) | TCP client/server responsibilities and transfer behavior. |
| [Evaluation](docs/evaluation.md) | PSNR, SSIM, timing, throughput, and experiment design. |
| [Testing](docs/testing.md) | Unit, integration, API, frontend, security, and performance checks. |
| [Limitations](docs/limitations.md) | Security assumptions, known limitations, and non-goals. |
| [Development roadmap](docs/development-roadmap.md) | Incremental implementation phases and completion criteria. |

## Planned user flow

## Current encryption-only demo

1. Open the Encryption Lab.
2. Enter a message or load the supplied sample message.
3. Submit the message to the backend encryption demo.
4. The backend performs a real authenticated in-memory sender/receiver handshake.
5. The message is encrypted with AES-256-GCM using an HKDF-derived session key.
6. The responder decrypts and verifies the payload.
7. The UI displays the verified recovery, ciphertext, nonce, fingerprints, transcript hash, and algorithm details.

The current UI does not perform image embedding, QIM, or TCP image transfer.

## Full planned flow

1. A receiver opens the Receive page and creates a receiving session.
2. The application displays a short-lived session code and the receiver identity fingerprint.
3. The sender enters the session code, writes a message, and selects a cover image.
4. The backend validates the image and message size.
5. The endpoints perform authenticated X25519 key exchange.
6. HKDF derives a per-session AES-256-GCM key.
7. The sender encrypts the message and embeds the encrypted payload using QIM.
8. The resulting PNG is transferred through the Python TCP networking layer.
9. The receiver reconstructs the PNG and extracts the embedded payload.
10. AES-GCM authenticates and decrypts the payload.
11. The receiver sees plaintext only after successful verification.
12. The Analysis page displays measured image and transfer metrics.

## Planned local development

The implementation will use two processes:

```text
Frontend:  http://localhost:5173
Backend:   http://localhost:8000
TCP layer: 127.0.0.1:8765
```

The browser will communicate with FastAPI over HTTP. Browser JavaScript will not open TCP sockets directly.

Install the backend dependencies in a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
```

Copy `.env.example` to `.env` or export the variables in your shell. The backend currently reads environment variables directly, so shell exports are the portable option:

```bash
set -a
source .env
set +a
```

Backend startup:

```bash
uvicorn app.main:app --reload --app-dir backend
```

Frontend startup:

```bash
cd frontend
npm install
npm run dev
```

The Vite development proxy forwards `/api` requests to `http://localhost:8000`. The frontend can also use `VITE_API_BASE_URL=http://localhost:8000` or `VITE_API_BASE_URL=http://localhost:8000/api`; both forms are normalized to the API path.

## Planned verification commands

Backend, from `backend/`:

```bash
cd backend
pytest -q
ruff check app tests
mypy app
```

Frontend:

```bash
cd frontend
npm run lint
npm run typecheck
npm run test
npm run build
```

These commands are documentation for the implementation phase. They will become executable once the source code and dependency manifests are added.

## Security position

StegoCrypt is an educational prototype, not a production messaging system. It will use established cryptographic libraries and will not implement cryptographic primitives manually. The project will explicitly document its trust model, local key configuration, payload limits, in-memory session behavior, and the lack of robustness against JPEG compression or image resizing.
# dps
# dps

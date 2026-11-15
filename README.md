# StegoCrypt

StegoCrypt is a locally runnable academic web application for secure text communication using:

- React and TypeScript for the browser interface.
- FastAPI and Python for the API backend.
- Authenticated X25519 key exchange and Ed25519 signatures.
- HKDF-SHA256 key derivation.
- AES-256-GCM authenticated encryption.
- Quantization Index Modulation (QIM) image steganography.
- Length-framed TCP socket communication.
- PSNR, SSIM, MSE/RMSE, changed-sample share, embedding rate, ciphertext entropy, capacity, timing, throughput, and recovery measurements.

The full workflow is exposed in the interface: create a receiving session, pair a sender with a one-shot join code, encrypt the message, embed it with QIM, transfer the PNG over TCP, recover it, and inspect measured image and network metrics. A separate Encryption Lab shows the cryptographic exchange on its own, without image processing or transfer.

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
| [Evaluation](docs/evaluation.md) | Image-quality, embedding-footprint, entropy, timing, throughput, and experiment design. |
| [Testing](docs/testing.md) | Unit, integration, API, frontend, security, and performance checks. |
| [Limitations](docs/limitations.md) | Security assumptions, known limitations, and non-goals. |
| [Development roadmap](docs/development-roadmap.md) | Incremental implementation phases and completion criteria. |

## Full workflow

1. Open the Receive page and create a receiving session.
2. Share the session ID and eight-character join code with the sender.
3. Open the Send page in another tab (or on another machine), enter the session ID and join code, and pair.
4. Write a message and select a cover image.
5. The backend performs the authenticated handshake, derives the AES-256-GCM key, encrypts the message, embeds the payload with QIM, and transfers the PNG over TCP.
6. The receiver page follows the phases and shows plaintext only after the CRC and AES-GCM checks pass.
7. Open the Analysis page to view measured image error, changed-sample share, embedding rate, ciphertext entropy, capacity, phase timings, throughput, and round-trip verification for that message.

The Encryption Lab remains available as a focused view of the cryptographic exchange.

## Local development

The local demonstration uses two processes:

```text
Frontend:  http://localhost:5173
Backend:   http://localhost:8000
TCP layer: 127.0.0.1:8765
```

The browser will communicate with FastAPI over HTTP. Browser JavaScript will not open TCP sockets directly.

Install the backend dependencies in a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
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

## Verification commands

Backend, from `backend/` (with the virtual environment active):

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

The backend suite uses a POSIX permission check for the identity key file. That check is skipped on Windows, where POSIX mode bits are not authoritative.

## Security position

StegoCrypt is an educational prototype, not a production messaging system. It uses established cryptographic libraries and does not implement cryptographic primitives manually. The trust model, local key configuration, payload limits, in-memory session behavior, and the lack of robustness against JPEG compression or image resizing are documented in [docs/limitations.md](docs/limitations.md).

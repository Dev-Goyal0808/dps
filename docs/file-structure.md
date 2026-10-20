# StegoCrypt File Structure

This document defines the responsibility of every planned file. The implementation should preserve these boundaries instead of placing the complete application in one file.

## 1. Root files

| File | Responsibility |
| --- | --- |
| `README.md` | Project introduction, setup, quick start, and links to detailed documentation. |
| `.gitignore` | Exclude virtual environments, node modules, local keys, runtime files, generated images, and secrets. |
| `.env.example` | Safe configuration template containing placeholders only. |

## 2. Backend configuration and entry point

| File | Responsibility |
| --- | --- |
| `backend/requirements.txt` | Runtime Python dependencies. |
| `backend/requirements-dev.txt` | Runtime dependencies plus pytest, linting, typing, and test tools. |
| `backend/pyproject.toml` | Python tooling, formatting, linting, and type-check configuration. |
| `backend/app/main.py` | Creates the FastAPI app, registers routes, configures CORS, and starts lifecycle hooks. |
| `backend/app/config.py` | Loads typed environment configuration and validates limits. |
| `backend/app/__init__.py` | Marks the application package. |

## 3. API layer

| File | Responsibility |
| --- | --- |
| `backend/app/api/__init__.py` | Marks the API package. |
| `backend/app/api/dependencies.py` | Resolves bearer tokens, sessions, and role-specific authorization. |
| `backend/app/api/health.py` | Implements the health endpoint. |
| `backend/app/api/sessions.py` | Creates sessions, pairs senders, and reports session status. |
| `backend/app/api/messages.py` | Accepts message/image uploads and exposes authorized results. |
| `backend/app/api/evaluation.py` | Runs authorized evaluation and returns measured metrics. |

Routes must remain thin. Business rules belong in services, and cryptographic/image/network operations belong in their respective modules.

## 4. API schemas

| File | Responsibility |
| --- | --- |
| `backend/app/schemas/__init__.py` | Marks the schema package. |
| `backend/app/schemas/common.py` | Shared status, error, pagination, and identifier schemas. |
| `backend/app/schemas/sessions.py` | Session creation, connection, status, and authorization schemas. |
| `backend/app/schemas/messages.py` | Message status, result, metrics, and upload-related schemas. |
| `backend/app/schemas/evaluation.py` | Evaluation request and response schemas. |

Pydantic schemas define the public API contract. They must not contain private keys, AES keys, shared secrets, or plaintext in status models.

## 5. Services

| File | Responsibility |
| --- | --- |
| `backend/app/services/__init__.py` | Marks the service package. |
| `backend/app/services/session_manager.py` | In-memory sessions, join codes, token hashes, roles, expiration, and state transitions. |
| `backend/app/services/workflow_service.py` | Coordinates the complete send and receive workflow. |
| `backend/app/services/metrics_service.py` | Records durations, throughput, PSNR, SSIM, capacity, and recovery state. |
| `backend/app/services/result_store.py` | Stores temporary authorized results and controls plaintext access. |

## 6. Cryptography modules

| File | Responsibility |
| --- | --- |
| `backend/app/crypto/__init__.py` | Marks the cryptography package. |
| `backend/app/crypto/identity.py` | Ed25519 identity key generation, loading, public-key fingerprints, and trust lookup. |
| `backend/app/crypto/key_exchange.py` | X25519 ephemeral key exchange and signed handshake transcript. |
| `backend/app/crypto/key_derivation.py` | HKDF-SHA256 derivation with context separation. |
| `backend/app/crypto/aead.py` | AES-256-GCM encrypt/decrypt, nonce generation, and tag verification. |
| `backend/app/crypto/payload.py` | Binary encrypted payload serialization and validation. |

No route or frontend file should implement cryptographic primitives.

## 7. Steganography modules

| File | Responsibility |
| --- | --- |
| `backend/app/steganography/__init__.py` | Marks the steganography package. |
| `backend/app/steganography/image_io.py` | Image loading, format validation, RGB conversion, size checks, and PNG output. |
| `backend/app/steganography/qim.py` | Scalar QIM bit embedding and extraction. |
| `backend/app/steganography/capacity.py` | Capacity calculations and insufficient-capacity errors. |
| `backend/app/steganography/payload_codec.py` | Stego header, payload length, quantizer ID, and CRC encoding/decoding. |

The steganography layer must not know about browser tokens or API authorization.

## 8. Networking modules

| File | Responsibility |
| --- | --- |
| `backend/app/networking/__init__.py` | Marks the networking package. |
| `backend/app/networking/framing.py` | Length-prefix encoding, exact reads, frame limits, and frame decoding. |
| `backend/app/networking/protocol.py` | Frame types, handshake messages, metadata, and transfer state definitions. |
| `backend/app/networking/tcp_client.py` | Sender-side socket connection, handshake, chunk sending, and timeout handling. |
| `backend/app/networking/tcp_server.py` | Receiver-side listener, connection acceptance, handshake, chunk receiving, and cleanup. |

The networking layer transfers bytes and protocol metadata. It does not display messages or calculate browser UI state.

## 9. Utility modules

| File | Responsibility |
| --- | --- |
| `backend/app/utils/__init__.py` | Marks the utility package. |
| `backend/app/utils/errors.py` | Internal exception types and safe error conversion. |
| `backend/app/utils/timing.py` | Monotonic phase timers and duration summaries. |
| `backend/app/utils/security.py` | Constant-time comparisons, token hashing, and safe redaction helpers. |

## 10. Frontend files

| File | Responsibility |
| --- | --- |
| `frontend/package.json` | Frontend dependencies and npm scripts. |
| `frontend/tsconfig.json` | TypeScript compiler configuration. |
| `frontend/vite.config.ts` | Vite development and test configuration. |
| `frontend/tailwind.config.ts` | Tailwind content paths and theme configuration. |
| `frontend/postcss.config.js` | Tailwind and PostCSS integration. |
| `frontend/index.html` | Browser document shell. |
| `frontend/src/main.tsx` | React entry point. |
| `frontend/src/App.tsx` | Router and page composition. |
| `frontend/src/index.css` | Tailwind directives, global styles, and accessibility defaults. |
| `frontend/src/types/api.ts` | TypeScript representations of backend schemas. |
| `frontend/src/services/api.ts` | Typed HTTP client and multipart upload helpers. |
| `frontend/src/hooks/useSessionStatus.ts` | Polls session status and exposes loading/error state. |
| `frontend/src/components/AppShell.tsx` | Shared navigation and application layout. |
| `frontend/src/components/StatusBadge.tsx` | Consistent status presentation. |
| `frontend/src/components/ProgressTimeline.tsx` | Workflow phase and transfer progress display. |
| `frontend/src/components/ImageDropzone.tsx` | Cover-image selection and client-side preview validation. |
| `frontend/src/components/ImagePreview.tsx` | Safe image preview component. |
| `frontend/src/components/MetricCard.tsx` | Evaluation metric display. |
| `frontend/src/components/ErrorAlert.tsx` | User-safe error presentation. |
| `frontend/src/components/WorkflowDiagram.tsx` | Home-page sender/receiver workflow visualization. |
| `frontend/src/pages/HomePage.tsx` | Landing dashboard. |
| `frontend/src/pages/SendMessagePage.tsx` | Sender workflow. |
| `frontend/src/pages/ReceiveMessagePage.tsx` | Receiver workflow. |
| `frontend/src/pages/AnalysisPage.tsx` | Image and performance evaluation. |
| `frontend/src/pages/AboutPage.tsx` | Technical overview and limitations. |

## 11. Tests

| Test location | Responsibility |
| --- | --- |
| `backend/tests/conftest.py` | Shared backend fixtures, test settings, and local socket helpers. |
| `backend/tests/crypto/` | Key exchange, encryption, tamper rejection, and payload serialization. |
| `backend/tests/crypto/test_aead.py` | AES-GCM round trips, nonce handling, and tamper rejection. |
| `backend/tests/crypto/test_key_exchange.py` | Authenticated X25519/Ed25519 handshake behavior. |
| `backend/tests/crypto/test_payload.py` | Encrypted payload serialization and malformed-input validation. |
| `backend/tests/steganography/` | QIM round trips, capacity limits, malformed headers, and image validation. |
| `backend/tests/steganography/test_qim.py` | QIM bit embedding and extraction. |
| `backend/tests/steganography/test_capacity.py` | Capacity calculations and boundary errors. |
| `backend/tests/steganography/test_image_io.py` | Image validation and PNG output. |
| `backend/tests/networking/` | Partial reads, frame limits, transfer digest, timeout, and disconnect behavior. |
| `backend/tests/networking/test_framing.py` | Length-prefixed frame encoding and fragmented reads. |
| `backend/tests/networking/test_tcp_transfer.py` | Local TCP transfer and failure behavior. |
| `backend/tests/api/` | Endpoint validation, authorization, status transitions, and safe errors. |
| `backend/tests/api/test_health.py` | Health endpoint behavior. |
| `backend/tests/api/test_sessions.py` | Session creation, pairing, status, and authorization. |
| `backend/tests/api/test_messages.py` | Upload, workflow, result, and error behavior. |
| `backend/tests/integration/` | Complete local sender-to-receiver recovery. |
| `backend/tests/integration/test_end_to_end.py` | Full authenticated encryption, QIM, TCP, extraction, and recovery flow. |
| `frontend/tests/` | Page behavior, API state handling, and verified-only plaintext display. |
| `frontend/tests/SendMessagePage.test.tsx` | Sender form, image selection, and progress behavior. |
| `frontend/tests/ReceiveMessagePage.test.tsx` | Receiver session, polling, and verified result behavior. |
| `frontend/tests/components.test.tsx` | Shared status, preview, alert, and metric components. |

# StegoCrypt Development Roadmap

## Phase 0: Documentation and scaffold

Deliverables:

- Root project structure.
- Dependency manifests.
- Environment template.
- Documentation set.
- Basic backend/frontend startup configuration.

Exit criteria:

- A new developer can understand the intended architecture from the documentation.
- No secrets or generated runtime files are committed.

## Phase 1: Cryptographic core

Deliverables:

- Ed25519 identity management.
- X25519 authenticated handshake.
- HKDF key derivation.
- AES-256-GCM encryption/decryption.
- Encrypted payload codec.
- Unit tests for normal and tampered inputs.

Exit criteria:

- Valid peers derive the same session key.
- Invalid signatures fail.
- Tampered ciphertext fails.
- Plaintext is never returned after failed authentication.

## Phase 2: QIM core

Deliverables:

- Image validation.
- Capacity calculator.
- Stego header codec.
- QIM embed/extract.
- PNG output validation.
- PSNR and SSIM calculation.

Exit criteria:

- A payload survives a lossless embed/extract round trip.
- Capacity errors are deterministic.
- Boundary image values are handled safely.

## Phase 3: TCP networking

Deliverables:

- Length-prefixed frames.
- Exact read/write helpers.
- Handshake transport.
- Chunked PNG transfer.
- Digest validation.
- Timeouts and cleanup.

Exit criteria:

- A generated PNG transfers over localhost.
- Fragmented socket reads are handled.
- Oversized and incomplete frames fail safely.

## Phase 4: Backend integration

Deliverables:

- FastAPI application.
- Session manager.
- Role-based temporary tokens.
- Message workflow service.
- Status endpoint.
- Authorized results.
- Evaluation endpoint.

Exit criteria:

- The complete workflow works without a browser using API tests.
- Status updates expose no secrets.
- Unauthorized result access is rejected.

## Phase 5: Frontend

Deliverables:

- React routing.
- Home page.
- Send page.
- Receive page.
- Analysis page.
- About page.
- Image previews.
- Progress timeline.
- Error handling.

Exit criteria:

- A user can run the end-to-end workflow through the browser.
- Authentication failure never displays unverified plaintext.

## Phase 6: Evaluation and hardening

Deliverables:

- Full test suite.
- PSNR/SSIM experiments.
- Localhost performance results.
- LAN demonstration instructions.
- Security test cases.
- Final limitations documentation.

Exit criteria:

- All implemented checks have actual recorded results.
- Measured values are clearly separated from theoretical claims.
- The project can be demonstrated from a clean setup.

## Suggested implementation order within each phase

1. Define a small interface.
2. Write the unit test for the interface.
3. Implement the smallest correct behavior.
4. Add malformed-input tests.
5. Integrate with the next layer.
6. Run the relevant checks.
7. Update the documentation when behavior changes.

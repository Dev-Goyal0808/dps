# StegoCrypt Limitations and Security Assumptions

## 1. Educational prototype

StegoCrypt is designed to demonstrate integration of cryptography, image steganography, web APIs, and TCP networking. It is not a production messaging platform and should not be used for high-value secrets.

## 2. Trust configuration

Authenticated key exchange is only meaningful if the trusted public keys are configured correctly. If an attacker can replace the trusted Ed25519 public key, the application cannot recognize that endpoint as untrusted.

The application will display fingerprints to support manual verification, but it will not claim automatic global identity management.

## 3. Local session storage

Initial sessions and results are held in memory:

- Restarting the backend removes sessions.
- Restarting the backend removes temporary results.
- The prototype does not provide durable message history.
- The prototype does not provide multi-user account management.

## 4. QIM robustness

The QIM implementation is intended for lossless PNG transfer. It is not expected to survive:

- JPEG recompression.
- Resizing.
- Cropping.
- Rotation.
- Color conversion.
- Filtering.
- Social-media processing.

The Analysis page and documentation must make this limitation visible.

## 5. Endpoint compromise

The design does not protect a compromised endpoint. An attacker with access to a backend process, identity private key, browser runtime, or memory may access messages or impersonate an endpoint.

## 6. Browser limitations

The browser is not a secure key vault. Temporary tokens are kept in memory where practical, but a compromised browser environment could still access them.

The browser does not communicate directly over TCP. This reduces complexity but means the FastAPI backend is part of the trusted workflow.

## 7. Metadata exposure

The following metadata may be visible to the backend or network observer:

- Connection timing.
- Image size.
- TCP endpoint address.
- Session timing.
- Transfer size.
- Session status.

The design hides message contents and embeds the encrypted payload in the image, but it does not hide all communication metadata.

## 8. Resource limits

Fixed limits are required to prevent memory and processing abuse. Large messages may require larger images. A capacity error is expected behavior, not a cryptographic failure.

## 9. No transformation resilience

The first version does not include error-correcting codes, spread-spectrum watermarking, or redundant embedding. Those features could improve robustness but would make the academic prototype more complex.

## 10. Production hardening not included

The first version does not include:

- Production TLS termination configuration.
- Persistent user accounts.
- Hardware-backed key storage.
- Distributed session storage.
- Rate limiting across multiple backend instances.
- Full audit logging.
- Secure deletion guarantees.
- Public internet deployment guidance.

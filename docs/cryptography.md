# StegoCrypt Cryptography Design

## 1. Goals

The cryptographic layer must provide:

- Confidentiality of the message.
- Detection of message tampering.
- Authentication of the communicating endpoints.
- Fresh per-session encryption keys.
- No manual implementation of cryptographic primitives.

The implementation will use the Python `cryptography` library.

## 2. Algorithms

| Purpose | Algorithm |
| --- | --- |
| Endpoint identity | Ed25519 |
| Authenticated ephemeral key exchange | X25519 with Ed25519 signatures |
| Key derivation | HKDF-SHA256 |
| Message encryption and authentication | AES-256-GCM |
| Public-key fingerprint | SHA-256 |
| Transport image digest | SHA-256 |

## 3. Identity keys

Each endpoint has an Ed25519 key pair:

```text
identity_private_key
identity_public_key
```

The private key is loaded only by the backend. It must be:

- Stored outside committed source code.
- Read with restrictive filesystem permissions where supported.
- Excluded by `.gitignore`.
- Redacted from exceptions and logs.

The public key is shared through trusted configuration. A short fingerprint is displayed to help users compare identities through an independent channel.

## 4. Authenticated key exchange

Plain X25519 does not authenticate the peer and is vulnerable to a man-in-the-middle attack. StegoCrypt therefore signs the exchange transcript with the long-term Ed25519 identity key.

### Exchange sequence

1. Sender generates a new X25519 ephemeral key pair.
2. Receiver generates a new X25519 ephemeral key pair.
3. Sender signs its role, session ID, public identity key, ephemeral key, protocol version, and nonce.
4. Receiver verifies the sender identity against its trusted configuration.
5. Receiver signs the complete transcript.
6. Sender verifies the receiver identity against its trusted configuration.
7. Both sides calculate the X25519 shared secret.
8. Both sides derive a transcript-bound session key using HKDF.
9. Both sides exchange a finished confirmation.

### Replay prevention

Each exchange includes:

- A newly generated session ID.
- A fresh handshake nonce.
- Fresh ephemeral X25519 keys.

The receiver rejects a handshake for an expired, already-completed, or unknown session.

## 5. HKDF derivation

The shared X25519 secret is not used directly as an AES key.

```text
transcript_hash = SHA256(canonical_handshake_transcript)
salt            = transcript_hash
info            = "StegoCrypt v1 message encryption key"
length          = 32 bytes
hash            = SHA-256
```

If additional keys are introduced later, each must use a separate `info` value.

## 6. AES-256-GCM message encryption

For each message:

1. Generate a random 12-byte nonce.
2. Encrypt the UTF-8 message with AES-256-GCM.
3. Include protocol metadata as associated authenticated data.
4. Store the nonce and ciphertext-plus-tag in the encrypted payload.

Associated data will bind:

- Protocol version.
- Session ID.
- Message ID.
- Algorithm identifier.

The nonce does not need to be secret, but it must never be reused with the same AES key.

## 7. Encrypted payload structure

```text
┌───────────────┬──────┬───────────┬────────────┬─────────────┬────────────────┐
│ magic: 4      │ ver  │ algorithm │ nonce len  │ message ID  │ nonce + cipher │
│ "SCEP"        │ u8   │ u8        │ u8         │ 16 bytes    │ + GCM tag      │
└───────────────┴──────┴───────────┴────────────┴─────────────┴────────────────┘
```

The payload codec validates:

- Magic bytes.
- Supported version.
- Supported algorithm.
- Expected nonce length.
- Maximum ciphertext length.
- Complete payload boundaries.

## 8. Authentication failure behavior

Any of the following must reject the result:

- Invalid peer signature.
- Unknown peer identity.
- Transcript mismatch.
- Failed finished confirmation.
- Invalid AES-GCM tag.
- Invalid associated data.
- Malformed encrypted payload.

The API returns a safe error code. It does not return partially decrypted plaintext.

## 9. Threat model

The design protects against:

- Passive observation of the TCP stream.
- Modification of the encrypted message.
- Modification of the transferred image bytes.
- Use of an untrusted peer identity when trust configuration is correct.
- Malformed payload and oversized-input attacks within configured limits.

The initial design does not solve:

- Compromise of a backend host.
- Theft of an identity private key.
- Malicious configuration of trusted public keys.
- Compromised browser JavaScript.
- Endpoint screenshots or plaintext capture.
- Secure deletion guarantees for in-memory plaintext.

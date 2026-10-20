# StegoCrypt QIM Steganography Design

## 1. Purpose

The steganography layer hides the already encrypted binary message inside an ordinary-looking image. It does not replace cryptography. QIM conceals the existence of the encrypted payload, while AES-GCM protects the message contents and detects tampering.

## 2. Image rules

Input handling:

- Decode the file with Pillow.
- Do not trust the filename extension or browser MIME type alone.
- Enforce maximum upload bytes, width, and height.
- Convert the decoded image to RGB.
- Reject images that cannot be decoded or have unsupported dimensions.

Output handling:

- Save the stego image as PNG.
- Reopen the generated file before reporting success.
- Verify that the output is within the maximum generated-image size.

JPEG input can be accepted for convenience, but the resulting output is always PNG. The initial implementation assumes that the PNG will not be transformed after embedding.

## 3. QIM approach

The first version uses scalar QIM over RGB channel samples.

For each usable channel sample:

1. Select a quantization interval using the configured step `delta`.
2. Map the payload bit to one of two quantization parities.
3. Write a representative value for the selected parity.
4. Clip the result to the valid 0–255 range.

Initial configuration:

```text
delta = 8
channels = R, G, B
alpha channel = ignored
scan order = row-major pixels, then RGB channels
```

The implementation must use the same scan order, quantizer ID, and delta interpretation during extraction.

## 4. Stego header

The header is embedded before the encrypted payload:

```text
StegoHeader:
├── magic          4 bytes: "SCQ1"
├── version        1 byte
├── quantizer_id   1 byte
├── reserved       2 bytes
├── payload_length 4 bytes, unsigned big-endian
└── payload_crc32  4 bytes, unsigned big-endian
```

The header is fixed-size and uses network byte order for multi-byte integers.

The CRC is an extraction sanity check. It is not a security mechanism; AES-GCM authentication remains authoritative.

## 5. Capacity calculation

For an RGB image where one bit is stored per channel:

```text
available_bits = width × height × 3
available_bytes = floor(available_bits / 8)
required_bits = (header_bytes + encrypted_payload_bytes) × 8
```

Embedding is rejected if:

```text
required_bits > available_bits
```

The error should report:

- Image dimensions.
- Available capacity in bytes.
- Required payload bytes.
- Configured quantizer.

It must not report plaintext or cryptographic key material.

## 6. Embedding sequence

1. The crypto layer returns a serialized encrypted payload.
2. The payload codec calculates the CRC32.
3. The stego header and payload are converted to bits.
4. The capacity service validates the required size.
5. The QIM module embeds bits in deterministic RGB order.
6. The image is converted to PNG.
7. The output is reopened and validated.
8. Metrics compare the original RGB image and stego RGB image.

## 7. Extraction sequence

1. Decode the received PNG as RGB.
2. Extract the fixed-size header bits.
3. Validate magic, version, quantizer, and payload length.
4. Reject lengths above configured limits.
5. Confirm the requested number of payload bits fits in the image.
6. Extract the encrypted payload bits.
7. Verify CRC32.
8. Pass the payload to the crypto layer.
9. Decrypt and authenticate using AES-GCM.
10. Expose plaintext only if authentication succeeds.

## 8. Quality and capacity trade-off

The quantization step influences both capacity and image distortion:

- A smaller step generally produces less visible distortion but may make bits less separable.
- A larger step generally improves bit separation but increases distortion.
- Using all RGB channels increases capacity.
- Using fewer channels may improve visual quality but reduces capacity.

The implementation will begin with `delta = 8` and measure actual PSNR and SSIM rather than claiming a fixed quality result.

## 9. Robustness limitations

This is a lossless PNG steganography demonstration. It is not designed to survive:

- JPEG compression.
- Resizing.
- Cropping.
- Rotation.
- Color-profile conversion.
- Heavy filtering.
- Social-media image processing.

These limitations must be shown on the About and Analysis pages.

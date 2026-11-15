# StegoCrypt Evaluation Plan

## 1. Evaluation goals

The evaluation dashboard must distinguish measured values from theoretical expectations. It will report:

- Image distortion.
- Image similarity.
- Payload size.
- Embedding capacity.
- Processing durations.
- Network transfer time.
- Throughput.
- Recovery and tamper-detection status.
- Sample-level image error (MSE, RMSE, maximum channel error).
- How much of the carrier actually changed (changed samples and their share).
- Embedding rate in bits per pixel.
- Payload overhead over the plaintext.
- Shannon entropy of the serialized payload.

## 2. PSNR

For original image `I` and stego image `K`, calculate mean squared error:

```text
MSE = mean((I - K)²)
```

Then calculate:

```text
PSNR = 10 × log10(MAX² / MSE)
```

For 8-bit RGB images:

```text
MAX = 255
```

If MSE is zero, PSNR is reported as infinite or as a documented special value.

## 3. SSIM

SSIM will be calculated using a tested image-quality implementation such as `skimage.metrics.structural_similarity`.

The evaluation must document:

- Whether RGB or grayscale comparison is used.
- The window size and channel handling.
- How very small images are handled.
- Whether the comparison uses the original in-memory RGB image or the reloaded PNG.

The recommended initial choice is RGB comparison on the original and reloaded PNG images.

The implementation uses the global SSIM formula over all RGB samples with the standard 8-bit constants `C1 = 6.5025` and `C2 = 58.5225`. A small payload touches a tiny fraction of samples, so this value sits at or extremely near `1.0` and is not by itself evidence of quality. The sample-level metrics in section 10 are the discriminating measurements.

## 4. Capacity metrics

The dashboard will display:

```text
capacity_bytes
payload_bytes
capacity_utilization = payload_bytes / capacity_bytes
remaining_bytes = capacity_bytes - payload_bytes
```

Capacity is an image property. Payload size includes the encrypted payload but excludes browser and TCP metadata.

## 5. Timing metrics

Use `time.perf_counter()` for durations. Record separate phases:

- Input validation.
- Key exchange.
- Encryption.
- Embedding.
- PNG encoding.
- TCP connection.
- TCP transfer.
- PNG decoding.
- Extraction.
- Decryption and verification.

Metrics must be recorded by the backend and not inferred from browser wall-clock display time.

## 6. Throughput

For a successful image transfer:

```text
throughput_bytes_per_second = image_bytes / transfer_seconds
```

The dashboard should label whether the denominator includes only payload transfer or connection setup. The initial implementation will report both where possible:

- Raw transfer throughput.
- End-to-end transfer throughput including connection setup.

## 7. Recovery accuracy

For each test case record:

```text
recovered = original_message == verified_plaintext
```

A message with an authentication failure is not counted as a successful recovery even if a partial or coincidental plaintext string appears.

## 8. Tamper evaluation

At least the following tamper cases should be measured:

1. Modify one byte of the encrypted payload before embedding.
2. Modify one pixel in the stego image.
3. Modify one byte of the transferred PNG.
4. Use the wrong trusted identity key.
5. Modify the AES-GCM associated data.

Expected result:

- Transport tampering is detected by the image digest where applicable.
- Payload tampering is rejected by CRC or AES-GCM.
- Identity tampering is rejected by signature validation.
- No tampered plaintext is displayed.

## 9. Suggested experiment matrix

| Experiment | Image sizes | Message sizes | Measurements |
| --- | --- | --- | --- |
| Small local test | 320×240 | 32 B, 128 B | Recovery, PSNR, SSIM, timings. |
| Medium image test | 800×600 | 1 KiB, 8 KiB | Capacity utilization and quality. |
| Large payload test | 1280×720 | 32 KiB, 128 KiB | Embedding time, transfer time, throughput. |
| Capacity boundary | Several dimensions | Near capacity | Correct rejection and exact limit behavior. |
| Tamper test | One fixed image | One fixed message | Authentication failure rate. |
| LAN test | Two computers | Several message sizes | Network timing and throughput. |

## 10. Additional measured metrics

Every value in this section is computed from the current message: the in-memory cover image, the received PNG, the serialized payload, and the phase timers.

### 10.1 Sample-level image error

```text
MSE                = mean((I - K)²) over all RGB samples
RMSE               = sqrt(MSE)
max_abs_error      = max|I - K| over all RGB samples
changed_samples    = count(I != K)
changed_sample_ratio = changed_samples / (3 × width × height)
mean_abs_error_changed = sum(|I - K| over changed samples) / changed_samples
```

These stay informative when SSIM saturates: a larger payload changes more samples, and a larger QIM delta moves each changed sample further.

### 10.2 Embedding rate

```text
embedding_rate_bpp = (payload_bytes + 16) × 8 / (width × height)
```

The 16 bytes are the SCQ1 container header. Utilisation measures the same load against total capacity.

### 10.3 Payload overhead and entropy

```text
payload_overhead_bytes = payload_bytes - plaintext_bytes
```

The SCEP envelope adds a 23-byte header, a 12-byte nonce, and a 16-byte GCM tag, so the overhead is 51 bytes.

```text
ciphertext_entropy_bits_per_byte = -Σ p(b) × log2 p(b)
```

Measured over the serialized payload. The entropy of `N` sampled bytes is bounded by `min(8, log2(N))`, so a short message legitimately reports below 8 bits/byte; the reported ceiling makes that explicit. A value close to its ceiling means byte values are near-uniform, which is expected for authenticated ciphertext. This is a property of the output, not a security proof.

### 10.4 Timing and throughput

```text
workflow_time_ms = transmission + extraction + decryption   (receiver side)
throughput_bytes_per_second = image_bytes / transfer_seconds
payload_throughput_bytes_per_second = payload_bytes / workflow_seconds
```

Connection, key-exchange, encryption, and embedding durations are measured and published by the sender the moment the payload is embedded, before the image is sent. Transmission time and image throughput are measured by the receiver, so they share a clock with the receiver workflow time and payload throughput shown next to them. `payload_throughput` uses the receiver workflow (transfer + extraction + decryption). A field that has not been published yet is `null`, never `0` — the two mean different things.

### 10.5 Round-trip verification

`plaintext_match` compares the receiver's decrypted bytes with the sender's original input. A verified result requires both the CRC and GCM tag checks to pass and the bytes to be identical.

### 10.6 Evaluation request flag

With `include_image_comparison = false`, the evaluation returns capacity, crypto, timing, throughput, and recovery values while every image-derived field is `null`.

## 11. Interpretation

The application must not claim that a particular PSNR or SSIM value is guaranteed. Results depend on:

- Image content.
- Image dimensions.
- Quantization step.
- Payload size.
- Channel selection.
- Hardware.
- Network conditions.

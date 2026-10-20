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

## 10. Interpretation

The application must not claim that a particular PSNR or SSIM value is guaranteed. Results depend on:

- Image content.
- Image dimensions.
- Quantization step.
- Payload size.
- Channel selection.
- Hardware.
- Network conditions.

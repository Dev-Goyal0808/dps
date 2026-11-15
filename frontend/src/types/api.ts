export type SessionRole = 'receiver' | 'sender';

export type SessionPhase =
  | 'waiting'
  | 'pairing'
  | 'connected'
  | 'validating'
  | 'encrypting'
  | 'embedding'
  | 'transferring'
  | 'extracting'
  | 'verifying'
  | 'completed'
  | 'rejected'
  | 'failed'
  | 'expired';

export type RecoveryStatus = 'pending' | 'verified' | 'rejected';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export interface HealthResponse {
  status: string;
  version: string;
  tcp_listener: string;
}

export interface CreateSessionResponse {
  session_id: string;
  receiver_token: string;
  join_code: string;
  expires_at: string;
  receiver_fingerprint: string;
  status: SessionPhase;
}

export interface ConnectSessionResponse {
  session_id: string;
  sender_token: string;
  status: SessionPhase;
}

export interface SessionStatusResponse {
  session_id: string;
  status: SessionPhase;
  phase: SessionPhase;
  progress: number;
  bytes_sent?: number;
  bytes_total?: number;
  message_id?: string | null;
  error?: ApiErrorPayload | null;
  updated_at: string;
}

export interface SendMessageResponse {
  message_id: string;
  status: 'processing' | SessionPhase;
}

export interface MessageMetrics {
  payload_bytes?: number;
  plaintext_bytes?: number;
  capacity_bytes?: number;
  capacity_utilization?: number;
  remaining_bytes?: number;
  payload_overhead_bytes?: number;
  ciphertext_entropy_bits_per_byte?: number | null;
  ciphertext_entropy_ceiling_bits_per_byte?: number | null;
  psnr?: number | null;
  ssim?: number | null;
  mse?: number | null;
  rmse?: number | null;
  max_abs_error?: number | null;
  changed_samples?: number | null;
  total_samples?: number | null;
  changed_sample_ratio?: number | null;
  mean_abs_error_changed?: number | null;
  embedding_rate_bpp?: number | null;
  connection_time_ms?: number | null;
  key_exchange_time_ms?: number | null;
  encryption_time_ms?: number | null;
  embedding_time_ms?: number | null;
  extraction_time_ms?: number | null;
  decryption_time_ms?: number | null;
  transmission_time_ms?: number | null;
  workflow_time_ms?: number | null;
  throughput_bytes_per_second?: number | null;
  payload_throughput_bytes_per_second?: number | null;
  plaintext_match?: boolean | null;
  recovery_status?: string;
}

export interface MessageResult {
  message_id: string;
  recovery_status: RecoveryStatus;
  message: string | null;
  received_image_url?: string;
  metrics?: MessageMetrics;
  error?: ApiErrorPayload | null;
}

export interface EvaluationResponse extends MessageResult {
  measured_at?: string;
}

export interface EncryptionDemoRequest {
  message: string;
}

export type EncryptionAlgorithms = Record<string, string>;

export interface EncryptionDemoResponse {
  message_id: string;
  recovery_status: 'verified';
  recovered_message: string;
  ciphertext: string;
  serialized_payload: string;
  nonce: string;
  sender_fingerprint: string;
  receiver_fingerprint: string;
  transcript_hash: string;
  algorithm_details: EncryptionAlgorithms;
  payload_bytes: number;
}

export interface EncryptionPreview {
  algorithm: string;
  key_exchange: string;
  key_fingerprint: string;
  message_id: string;
  nonce_hex: string;
  ciphertext_hex: string;
  tag_hex: string;
  plaintext_bytes: number;
  payload_bytes: number;
  serialized_payload_hex: string;
  associated_data: string;
}

export interface BitPlacement {
  index: number;
  pixel: string;
  channel: 'R' | 'G' | 'B';
  bit: number;
  original: number;
  quantized: number;
}

export interface StegoPreview {
  image_width: number;
  image_height: number;
  qim_delta: number;
  capacity_bytes: number;
  required_bytes: number;
  capacity_utilization: number;
  header_hex: string;
  header: {
    magic: string;
    version: number;
    quantizer_id: number;
    payload_length: number;
    payload_crc32: number;
  };
  container_bytes: number;
  bits_embedded: number;
  bits_sample: string;
  container_hex_preview: string;
  bit_placements: BitPlacement[];
  modified_samples: number;
  mean_abs_delta: number;
  max_abs_delta: number;
  stego_image_url: string;
}

export interface MessagePreviewResponse {
  preview_id: string;
  session_id: string;
  message_id: string;
  encryption: EncryptionPreview;
  stego?: StegoPreview | null;
}

export interface EncryptionChannelResponse {
  session_id: string;
  sender_token: string;
  receiver_token: string;
  expires_at: string;
  sender_fingerprint: string;
  receiver_fingerprint: string;
  transcript_hash: string;
  algorithm_details: EncryptionAlgorithms;
}

export interface EncryptionSendResponse {
  session_id: string;
  message_id: string;
  status: string;
  ciphertext: string;
  serialized_payload: string;
  nonce: string;
  sender_fingerprint: string;
  receiver_fingerprint: string;
  transcript_hash: string;
  algorithm_details: EncryptionAlgorithms;
  payload_bytes: number;
}

export interface EncryptionReceiveResponse {
  session_id: string;
  message_id: string;
  recovery_status: RecoveryStatus;
  plaintext: string;
}

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
  capacity_bytes?: number;
  capacity_utilization?: number;
  remaining_bytes?: number;
  psnr?: number;
  ssim?: number;
  encryption_time_ms?: number;
  embedding_time_ms?: number;
  extraction_time_ms?: number;
  decryption_time_ms?: number;
  transmission_time_ms?: number;
  throughput_bytes_per_second?: number;
  raw_transfer_throughput_bytes_per_second?: number;
  end_to_end_throughput_bytes_per_second?: number;
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

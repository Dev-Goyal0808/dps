import type {
  ConnectSessionResponse,
  CreateSessionResponse,
  EncryptionDemoRequest,
  EncryptionDemoResponse,
  EvaluationResponse,
  HealthResponse,
  MessageResult,
  SendMessageResponse,
  SessionStatusResponse,
} from '../types/api';

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
// Accept either a complete API base (`http://localhost:8000/api`) or an API
// origin (`http://localhost:8000`) so local and deployed setups are harder to
// misconfigure. The Vite proxy continues to use the default `/api` value.
const API_BASE_URL = configuredApiBase.endsWith('/api') ? configuredApiBase : `${configuredApiBase}/api`;

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, code = 'REQUEST_FAILED', details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(response: Response): Promise<ApiClientError> {
  let body: { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | undefined;
  try {
    body = await response.json() as { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
  } catch {
    // Some proxies return an empty or non-JSON error body.
  }

  return new ApiClientError(
    body?.error?.message ?? `Request failed with status ${response.status}`,
    response.status,
    body?.error?.code ?? 'REQUEST_FAILED',
    body?.error?.details,
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    });
  } catch {
    throw new ApiClientError('The StegoCrypt service could not be reached.', 0, 'NETWORK_ERROR');
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return await response.json() as T;
}

export const api = {
  getHealth: () => request<HealthResponse>('/health'),

  createReceiverSession: () => request<CreateSessionResponse>('/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'receiver' }),
  }),

  connectSender: (sessionId: string, joinCode: string) => request<ConnectSessionResponse>(`/sessions/${encodeURIComponent(sessionId)}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ join_code: joinCode }),
  }),

  getSessionStatus: (sessionId: string, token: string) => request<SessionStatusResponse>(`/sessions/${encodeURIComponent(sessionId)}/status`, {
    headers: authHeaders(token),
  }),

  sendMessage: (token: string, sessionId: string, message: string, coverImage: File) => {
    const body = new FormData();
    body.append('session_id', sessionId);
    body.append('message', message);
    body.append('cover_image', coverImage);
    return request<SendMessageResponse>('/messages/send', {
      method: 'POST',
      headers: authHeaders(token),
      body,
    });
  },

  getMessageResult: (messageId: string, token: string) => request<MessageResult>(`/messages/${encodeURIComponent(messageId)}/result`, {
    headers: authHeaders(token),
  }),

  getMessageImage: async (messageId: string, token: string): Promise<Blob> => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/messages/${encodeURIComponent(messageId)}/image`, {
        headers: authHeaders(token),
      });
    } catch {
      throw new ApiClientError('The received image could not be reached.', 0, 'NETWORK_ERROR');
    }
    if (!response.ok) throw await parseError(response);
    return response.blob();
  },

  evaluateMessage: (messageId: string, token: string, includeImageComparison: boolean) => request<EvaluationResponse>('/evaluation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({ message_id: messageId, include_image_comparison: includeImageComparison }),
  }),

  runEncryptionDemo: (message: string) => request<EncryptionDemoResponse>('/encryption/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message } satisfies EncryptionDemoRequest),
  }),
};

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  return isApiClientError(error) ? error.message : error instanceof Error ? error.message : fallback;
}

export { API_BASE_URL };

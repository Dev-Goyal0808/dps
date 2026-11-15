import { describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api';

describe('encryption channel API client', () => {
  it('creates a channel and posts typed sender and receiver requests', async () => {
    const channel = {
      session_id: 'session-123',
      sender_token: 'sender-token',
      receiver_token: 'receiver-token',
      expires_at: '2026-10-21T12:30:00Z',
      sender_fingerprint: 'sha256:sender',
      receiver_fingerprint: 'sha256:receiver',
      transcript_hash: 'sha256:transcript',
      algorithm_details: { encryption: 'AES-256-GCM' },
    };
    const envelope = {
      session_id: 'session-123',
      message_id: 'message-123',
      status: 'stored',
      ciphertext: 'Y2lwaGVydGV4dA==',
      serialized_payload: 'c2VyaWFsaXplZC1wYXlsb2Fk',
      nonce: 'bm9uY2U=',
      sender_fingerprint: 'sha256:sender',
      receiver_fingerprint: 'sha256:receiver',
      transcript_hash: 'sha256:transcript',
      algorithm_details: { encryption: 'AES-256-GCM' },
      payload_bytes: 24,
    };
    const receive = {
      session_id: 'session-123',
      message_id: 'message-123',
      recovery_status: 'verified',
      plaintext: 'Recovered',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(channel), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(receive), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.createEncryptionChannel()).resolves.toEqual(channel);
    await expect(api.sendEncryptedMessage('sender-token', 'session-123', 'A private note')).resolves.toEqual(envelope);
    await expect(api.receiveEncryptedMessage('receiver-token', 'session-123', 'message-123', 'c2VyaWFsaXplZC1wYXlsb2Fk')).resolves.toEqual(receive);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/encryption/channels', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/encryption/channels/session-123/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer sender-token' },
      body: JSON.stringify({ message: 'A private note' }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/encryption/channels/session-123/receive', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer receiver-token' },
      body: JSON.stringify({ message_id: 'message-123', serialized_payload: 'c2VyaWFsaXplZC1wYXlsb2Fk' }),
    });
  });

  it('surfaces wrong-role and tamper responses as typed API errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'The bearer token has the wrong role.', details: {} } }), { status: 403, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'AUTHENTICATION_FAILED', message: 'The recovered payload could not be authenticated.', details: {} } }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.sendEncryptedMessage('receiver-token', 'session-123', 'A private note')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403, message: 'The bearer token has the wrong role.' });
    await expect(api.receiveEncryptedMessage('sender-token', 'session-123', 'message-123')).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED', status: 400, message: 'The recovered payload could not be authenticated.' });
  });
});

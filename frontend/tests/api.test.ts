import { describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api';

describe('encryption demo API client', () => {
  it('posts the message as JSON to the typed encryption demo endpoint', async () => {
    const response = {
      message_id: 'demo-123',
      status: 'verified',
      verified_message: 'Recovered',
      ciphertext_base64: 'Y2lwaGVydGV4dA==',
      nonce_base64: 'bm9uY2U=',
      sender_fingerprint: 'sha256:sender',
      receiver_fingerprint: 'sha256:receiver',
      transcript_hash: 'sha256:transcript',
      algorithms: ['AES-256-GCM'],
      payload_bytes: 24,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.runEncryptionDemo('A private note')).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith('/api/encryption/demo', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'A private note' }),
    });
  });
});

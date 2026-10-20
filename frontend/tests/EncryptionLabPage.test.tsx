import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EncryptionLabPage } from '../src/pages/EncryptionLabPage';
import { api } from '../src/services/api';

const demoResponse = {
  message_id: 'demo-123',
  recovery_status: 'verified' as const,
  recovered_message: 'The quietest signals can still carry a clear truth.',
  ciphertext: 'Y2lwaGVydGV4dA==',
  serialized_payload: 'c2VyaWFsaXplZC1wYXlsb2Fk',
  nonce: 'bm9uY2U=',
  sender_fingerprint: 'sha256:sender',
  receiver_fingerprint: 'sha256:receiver',
  transcript_hash: 'sha256:transcript',
  algorithm_details: {
    identity: 'Ed25519',
    key_exchange: 'X25519',
    key_derivation: 'HKDF-SHA256',
    encryption: 'AES-256-GCM',
    payload_format: 'EncryptedPayload v1',
  },
  payload_bytes: 32,
};

describe('EncryptionLabPage', () => {
  it('loads a sample message, submits it, and shows the verified inspection result', async () => {
    const user = userEvent.setup();
    const runDemo = vi.spyOn(api, 'runEncryptionDemo').mockResolvedValue(demoResponse);
    render(<EncryptionLabPage />);

    await user.click(screen.getByRole('button', { name: /use sample message/i }));
    expect(screen.getByLabelText(/message to encrypt/i)).toHaveValue('The quietest signals can still carry a clear truth.');
    await user.click(screen.getByRole('button', { name: /encrypt message/i }));

    await waitFor(() => expect(runDemo).toHaveBeenCalledWith('The quietest signals can still carry a clear truth.'));
    expect(await screen.findByText('Verified recovery')).toBeInTheDocument();
    expect(screen.getByText('Y2lwaGVydGV4dA==')).toBeInTheDocument();
    expect(screen.getByText('bm9uY2U=')).toBeInTheDocument();
    expect(screen.getByText('Key Exchange · X25519')).toBeInTheDocument();
    expect(screen.getByText('sha256:sender')).toBeInTheDocument();
    expect(screen.getByText(/Steganography is intentionally disabled/i)).toBeInTheDocument();
  });

  it('shows loading and API error states', async () => {
    const user = userEvent.setup();
    let rejectRequest!: (error: Error) => void;
    vi.spyOn(api, 'runEncryptionDemo').mockReturnValue(new Promise((_, reject) => { rejectRequest = reject; }));
    render(<EncryptionLabPage />);

    await user.type(screen.getByLabelText(/message to encrypt/i), 'A test message');
    await user.click(screen.getByRole('button', { name: /encrypt message/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/waiting for the verified recovery result/i);
    expect(screen.getByRole('button', { name: /encrypting and verifying/i })).toBeDisabled();

    rejectRequest(new Error('The demo service is unavailable.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The demo service is unavailable.');
  });
});

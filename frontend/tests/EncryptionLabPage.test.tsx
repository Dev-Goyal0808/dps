import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EncryptionLabPage } from '../src/pages/EncryptionLabPage';
import { api } from '../src/services/api';

const channel = {
  session_id: 'session-123',
  sender_token: 'sender-token',
  receiver_token: 'receiver-token',
  expires_at: '2026-10-21T12:30:00Z',
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
  algorithm_details: channel.algorithm_details,
  payload_bytes: 32,
};

const decrypted = {
  session_id: 'session-123',
  message_id: 'message-123',
  recovery_status: 'verified' as const,
  plaintext: 'The quietest signals can still carry a clear truth.',
};

describe('EncryptionLabPage', () => {
  it('creates a channel, sends an envelope, and decrypts it in a separate receiver step', async () => {
    const user = userEvent.setup();
    const createChannel = vi.spyOn(api, 'createEncryptionChannel').mockResolvedValue(channel);
    const sendMessage = vi.spyOn(api, 'sendEncryptedMessage').mockResolvedValue(envelope);
    const receiveMessage = vi.spyOn(api, 'receiveEncryptedMessage').mockResolvedValue(decrypted);
    render(<MemoryRouter><EncryptionLabPage /></MemoryRouter>);

    expect(await screen.findByText('Channel ready')).toBeInTheDocument();
    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Client Sender')).toBeInTheDocument();
    expect(screen.getByText('Client Receiver')).toBeInTheDocument();
    expect(screen.getAllByText('sha256:sender')).toHaveLength(2);
    expect(screen.getAllByText('sha256:receiver')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /use sample message/i }));
    expect(screen.getByLabelText(/message to protect/i)).toHaveValue('The quietest signals can still carry a clear truth.');
    await user.click(screen.getByRole('button', { name: /encrypt & send/i }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('sender-token', 'session-123', 'The quietest signals can still carry a clear truth.'));
    expect(screen.getByText('Received envelope')).toBeInTheDocument();
    expect(screen.getAllByText('Y2lwaGVydGV4dA==')).toHaveLength(2);
    expect(screen.queryByText('Verified plaintext')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^decrypt$/i }));
    await waitFor(() => expect(receiveMessage).toHaveBeenCalledWith('receiver-token', 'session-123', 'message-123', 'c2VyaWFsaXplZC1wYXlsb2Fk'));
    expect(await screen.findAllByText('The quietest signals can still carry a clear truth.')).toHaveLength(2);
    expect(screen.getByText('Verified plaintext')).toBeInTheDocument();
  });

  it('shows loading and channel or sender errors', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createEncryptionChannel').mockResolvedValue(channel);
    let rejectSend!: (error: Error) => void;
    vi.spyOn(api, 'sendEncryptedMessage').mockReturnValue(new Promise((_, reject) => { rejectSend = reject; }));
    render(<MemoryRouter><EncryptionLabPage /></MemoryRouter>);

    await screen.findByText('Channel ready');
    await user.type(screen.getByLabelText(/message to protect/i), 'A test message');
    await user.click(screen.getByRole('button', { name: /encrypt & send/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/sealing the message/i);
    expect(screen.getByRole('button', { name: /encrypting and sending/i })).toBeDisabled();

    rejectSend(new Error('The sender service is unavailable.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The sender service is unavailable.');
  });

  it('keeps plaintext hidden when the receiver rejects a tampered envelope', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createEncryptionChannel').mockResolvedValue(channel);
    vi.spyOn(api, 'sendEncryptedMessage').mockResolvedValue(envelope);
    vi.spyOn(api, 'receiveEncryptedMessage').mockRejectedValue(new Error('The recovered payload could not be authenticated.'));
    render(<MemoryRouter><EncryptionLabPage /></MemoryRouter>);

    await screen.findByText('Channel ready');
    await user.type(screen.getByLabelText(/message to protect/i), 'Tamper me');
    await user.click(screen.getByRole('button', { name: /encrypt & send/i }));
    await screen.findByText('Received envelope');
    await user.click(screen.getByRole('button', { name: /^decrypt$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The recovered payload could not be authenticated.');
    expect(screen.getByText('Plaintext stays hidden because this envelope was not authenticated.')).toBeInTheDocument();
    expect(screen.queryByText('Verified plaintext')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/message to protect/i)).toHaveValue('Tamper me');
  });
});

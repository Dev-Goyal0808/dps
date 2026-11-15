import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ReceiveMessagePage } from '../src/pages/ReceiveMessagePage';
import { SessionProvider } from '../src/context/SessionContext';
import { api } from '../src/services/api';

function renderReceivePage() {
  return render(<MemoryRouter><SessionProvider><ReceiveMessagePage /></SessionProvider></MemoryRouter>);
}

const createdSession = {
  session_id: 'session-456',
  receiver_token: 'receiver-token',
  join_code: 'B7K4M2Q9',
  expires_at: '2026-10-20T12:30:00Z',
  receiver_fingerprint: 'sha256:abcd1234',
  status: 'waiting' as const,
};

describe('ReceiveMessagePage', () => {
  it('creates a session, shows pairing details, and renders verified plaintext with metrics', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createReceiverSession').mockResolvedValue(createdSession);
    vi.spyOn(api, 'getSessionStatus').mockResolvedValue({ session_id: 'session-456', status: 'completed', phase: 'completed', progress: 1, message_id: 'message-456', updated_at: new Date().toISOString() });
    vi.spyOn(api, 'getMessageResult').mockResolvedValue({ message_id: 'message-456', recovery_status: 'verified', message: 'Verified hello', metrics: { psnr: 42.1, ssim: 0.99, payload_bytes: 128, capacity_bytes: 10000, capacity_utilization: 0.0128, throughput_bytes_per_second: 1000 } });
    vi.spyOn(api, 'getMessageImage').mockResolvedValue(new Blob(['png bytes'], { type: 'image/png' }));
    renderReceivePage();

    await user.click(screen.getByRole('button', { name: /create receiving session/i }));
    expect(await screen.findByText('B7K4M2Q9')).toBeInTheDocument();
    expect(screen.getByText('sha256:abcd1234')).toBeInTheDocument();
    expect(await screen.findByText('Verified hello')).toBeInTheDocument();
    expect(screen.getByText('42.1 dB')).toBeInTheDocument();
    expect(screen.getByText('Verified plaintext')).toBeInTheDocument();
    expect(await screen.findByAltText('Received stego image')).toBeInTheDocument();
  });

  it('never renders plaintext when recovery is rejected', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createReceiverSession').mockResolvedValue(createdSession);
    vi.spyOn(api, 'getSessionStatus').mockResolvedValue({ session_id: 'session-456', status: 'completed', phase: 'completed', progress: 1, message_id: 'message-456', updated_at: new Date().toISOString() });
    vi.spyOn(api, 'getMessageResult').mockResolvedValue({ message_id: 'message-456', recovery_status: 'rejected', message: null, error: { code: 'AUTHENTICATION_FAILED', message: 'The recovered payload could not be authenticated.' } });
    renderReceivePage();

    await user.click(screen.getByRole('button', { name: /create receiving session/i }));
    expect(await screen.findByText('Recovery rejected')).toBeInTheDocument();
    expect(screen.queryByText('Verified hello')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no recovered message is displayed/i)).toBeInTheDocument());
  });
});

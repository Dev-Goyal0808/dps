import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SendMessagePage } from '../src/pages/SendMessagePage';
import { api } from '../src/services/api';
import { SessionProvider } from '../src/context/SessionContext';

function renderSendPage() {
  return render(<MemoryRouter><SessionProvider><SendMessagePage /></SessionProvider></MemoryRouter>);
}

describe('SendMessagePage', () => {
  it('pairs, previews a cover image, and submits a message through the typed API client', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'connectSender').mockResolvedValue({ session_id: 'session-123', sender_token: 'sender-token', status: 'connected' });
    vi.spyOn(api, 'getSessionStatus').mockResolvedValue({ session_id: 'session-123', status: 'completed', phase: 'completed', progress: 1, message_id: 'message-123', updated_at: new Date().toISOString() });
    const sendMessage = vi.spyOn(api, 'sendMessage').mockResolvedValue({ message_id: 'message-123', status: 'processing' });
    renderSendPage();

    await user.type(screen.getByPlaceholderText('Paste the receiver session ID'), 'session-123');
    await user.type(screen.getByPlaceholderText('e.g. B7K4M2Q9'), 'B7K4M2Q9');
    await user.click(screen.getByRole('button', { name: /connect to receiver/i }));
    expect(await screen.findByText('Receiver connected')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Write the message that should be recovered…'), 'A secret note for the receiver.');
    const imageInput = screen.getByLabelText(/drop a cover image here/i);
    await user.upload(imageInput, new File(['png bytes'], 'cover.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: /encrypt and send/i }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('sender-token', 'session-123', 'A secret note for the receiver.', expect.objectContaining({ name: 'cover.png' })));
    expect(await screen.findByText('message-123')).toBeInTheDocument();
  });

  it('shows pairing errors returned by the API', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'connectSender').mockRejectedValue(new Error('The join code has expired.'));
    renderSendPage();
    await user.type(screen.getByPlaceholderText('Paste the receiver session ID'), 'session-123');
    await user.type(screen.getByPlaceholderText('e.g. B7K4M2Q9'), 'B7K4M2Q9');
    await user.click(screen.getByRole('button', { name: /connect to receiver/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The join code has expired.');
  });
});

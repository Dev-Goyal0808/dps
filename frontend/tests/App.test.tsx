import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { api } from '../src/services/api';

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

describe('application navigation', () => {
  it('lists every workflow page in the primary navigation', () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    const nav = screen.getByRole('navigation', { name: /primary navigation/i });
    for (const label of [/^home$/i, /^receive$/i, /^send$/i, /^analysis$/i, /^encryption lab$/i, /^how it works$/i]) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: /a message inside a picture/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start with a receiving room/i })).toHaveAttribute('href', '/receive');
  });

  it('opens the encryption lab from the navigation', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'createEncryptionChannel').mockResolvedValue(channel);
    window.history.pushState({}, '', '/');
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: /primary navigation/i })).getByRole('link', { name: /^encryption lab$/i }));
    expect(await screen.findByRole('heading', { name: /split the message/i })).toBeInTheDocument();
  });

  it('opens the receiver, sender, analysis, and about pages', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/');
    render(<App />);

    const nav = () => within(screen.getByRole('navigation', { name: /primary navigation/i }));

    await user.click(nav().getByRole('link', { name: /^receive$/i }));
    expect(await screen.findByRole('heading', { name: /receive a verified message/i })).toBeInTheDocument();

    await user.click(nav().getByRole('link', { name: /^send$/i }));
    expect(await screen.findByRole('heading', { name: /send a protected message/i })).toBeInTheDocument();

    await user.click(nav().getByRole('link', { name: /^analysis$/i }));
    expect(await screen.findByRole('heading', { name: /measure the transfer/i })).toBeInTheDocument();

    await user.click(nav().getByRole('link', { name: /^how it works$/i }));
    expect(await screen.findByRole('heading', { name: /a small system, explained end to end/i })).toBeInTheDocument();
  });

  it('falls back to the landing page for unknown paths', async () => {
    window.history.pushState({}, '', '/does-not-exist');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /a message inside a picture/i })).toBeInTheDocument();
  });
});

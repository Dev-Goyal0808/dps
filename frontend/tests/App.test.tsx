import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('application navigation', () => {
  it('exposes only the focused public pages and opens the Encryption Lab', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/');
    render(<App />);

    expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^encryption lab$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^about$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /send message|receive message|analysis/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /^encryption lab$/i }));
    expect(await screen.findByRole('heading', { name: /encrypt a message/i })).toBeInTheDocument();
  });

  it('redirects legacy workflow URLs to the Encryption Lab', async () => {
    window.history.pushState({}, '', '/receive');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /encrypt a message/i })).toBeInTheDocument();
  });
});

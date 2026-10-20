import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImageDropzone } from '../src/components/ImageDropzone';
import { MetricCard } from '../src/components/MetricCard';
import { ProgressTimeline } from '../src/components/ProgressTimeline';
import { StatusBadge } from '../src/components/StatusBadge';

describe('shared workflow components', () => {
  it('renders a readable status and progress state', () => {
    render(<><StatusBadge status="verifying" /><ProgressTimeline phase="transferring" progress={0.65} /></>);
    expect(screen.getByText('Verifying', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByLabelText('Message workflow progress')).toBeInTheDocument();
    expect(screen.getByText('Transferring')).toBeInTheDocument();
  });

  it('rejects unsupported image files and accepts a valid cover image', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    render(<ImageDropzone onChange={onChange} />);
    const input = screen.getByLabelText(/drop a cover image here/i);

    await user.upload(input, new File(['not an image'], 'notes.txt', { type: 'text/plain' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a PNG, JPEG, or WebP image.');
    expect(onChange).not.toHaveBeenCalled();

    await user.upload(input, new File(['png bytes'], 'cover.png', { type: 'image/png' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'cover.png' }));
  });

  it('formats measured values as a metric card', () => {
    render(<MetricCard label="PSNR" value="41.32 dB" detail="Image distortion" />);
    expect(screen.getByText('PSNR')).toBeInTheDocument();
    expect(screen.getByText('41.32 dB')).toBeInTheDocument();
    expect(screen.getByText('Image distortion')).toBeInTheDocument();
  });
});

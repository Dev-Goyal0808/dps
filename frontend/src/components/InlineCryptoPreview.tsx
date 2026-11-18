import {
  Binary,
  CheckCircle2,
  Download,
  Eye,
  Fingerprint,
  Image as ImageIcon,
  KeyRound,
  Lock,
  ScanLine,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ImagePreview } from './ImagePreview';
import type { MessagePreviewResponse } from '../types/api';

interface InlineCryptoPreviewProps {
  preview?: MessagePreviewResponse;
  image?: Blob;
  isLoading: boolean;
  error?: unknown;
  plaintext: string;
}

function HexScroll({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">{label}</div>
      <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ink px-2.5 py-2 font-mono text-[10px] leading-[1.6] text-aqua/90 scrollbar-thin">
        {value}
      </pre>
    </div>
  );
}

function Tag({ children, color = 'slate' }: { children: React.ReactNode; color?: 'aqua' | 'slate' | 'coral' | 'green' }) {
  const colors = {
    aqua: 'bg-aqua/10 text-[#087d73]',
    slate: 'bg-slate-100 text-slate-600',
    coral: 'bg-coral/10 text-[#9c3f2f]',
    green: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[color]}`}>
      {children}
    </span>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex flex-col items-center gap-0.5">
        <div className="h-4 w-px bg-slate-200" />
        <div className="h-0 w-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-300" />
      </div>
    </div>
  );
}

const CHANNEL_STYLES: Record<string, string> = {
  R: 'bg-[#f7d9d4] text-[#9c3f2f]',
  G: 'bg-[#d7efe3] text-[#1d6b4a]',
  B: 'bg-[#dbe5f7] text-[#274a86]',
};

export function InlineCryptoPreview({ preview, image, isLoading, error, plaintext }: InlineCryptoPreviewProps) {
  const [downloadUrl, setDownloadUrl] = useState<string>();
  const hasContent = Boolean(plaintext.trim());

  useEffect(() => {
    if (!image) { setDownloadUrl(undefined); return; }
    const url = URL.createObjectURL(image);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const { encryption, stego } = preview ?? {};
  const utilization = stego ? Math.round(stego.capacity_utilization * 1000) / 10 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[.18em] text-aqua">Live Crypto Preview</div>
          <h3 className="mt-0.5 text-sm font-bold text-ink">Encryption &amp; Steganography</h3>
        </div>
        {isLoading && (
          <span className="animate-pulse rounded-full bg-aqua/10 px-2.5 py-1 text-[10px] font-bold text-[#087d73]">
            Rebuilding…
          </span>
        )}
        {preview && !isLoading && (
          <Tag color="green"><CheckCircle2 className="mr-1 h-2.5 w-2.5" />Live</Tag>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-coral/30 bg-coral/5 p-3 text-xs text-[#9c3f2f]">
          <div className="font-bold">Preview unavailable</div>
          <p className="mt-1">{error instanceof Error ? error.message : 'Could not build preview.'}</p>
        </div>
      )}

      {/* Empty state */}
      {!hasContent && !preview && !error && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center">
          <Eye className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-xs font-semibold text-slate-500">Type your message</p>
          <p className="mt-1 text-[11px] text-slate-400">The encrypted ciphertext and hidden bitstream will appear here in real time.</p>
        </div>
      )}

      {/* Waiting for image */}
      {hasContent && !preview && !error && !isLoading && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center">
          <ImageIcon className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-xs font-semibold text-slate-500">Add a cover image</p>
          <p className="mt-1 text-[11px] text-slate-400">Steganography preview requires a cover image.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !preview && (
        <div className="space-y-3 animate-pulse">
          {[48, 32, 64, 32, 48].map((h, i) => (
            <div key={i} className="rounded-lg bg-slate-100" style={{ height: h }} />
          ))}
        </div>
      )}

      {/* Full preview */}
      {preview && (
        <div className="flex flex-col gap-4 overflow-y-auto pr-0.5" style={{ maxHeight: 'calc(100vh - 260px)' }}>

          {/* ── STEP 1: Plaintext ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
              <Sparkles className="h-3 w-3 text-slate-400" />
              Your plaintext message
            </div>
            <pre className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-emerald-50 px-2.5 py-2 font-mono text-[11px] leading-[1.6] text-emerald-800">
              {plaintext}
            </pre>
            <div className="mt-1.5 flex gap-2">
              <Tag color="green">{new TextEncoder().encode(plaintext).length} bytes</Tag>
              <Tag color="slate">plaintext</Tag>
            </div>
          </div>

          <FlowArrow />

          {/* ── STEP 2: Encryption ── */}
          <div className="rounded-xl border border-slate-200 bg-mist/40 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                <Lock className="h-3 w-3 text-aqua" />
                AES-256-GCM encryption
              </div>
              <Tag color="aqua">{encryption?.algorithm}</Tag>
            </div>

            {encryption && (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">Plaintext</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink">{encryption.plaintext_bytes} B</div>
                  </div>
                  <div className="rounded-lg bg-white px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">Payload</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink">{encryption.payload_bytes} B</div>
                  </div>
                </div>

                <HexScroll label="Nonce (12 B)" value={encryption.nonce_hex} />
                <HexScroll label="Ciphertext (hex)" value={encryption.ciphertext_hex || '(empty)'} />
                <HexScroll label="Auth tag (16 B)" value={encryption.tag_hex} />

                <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">
                    <KeyRound className="h-2.5 w-2.5" />Session key fingerprint
                  </div>
                  <p className="mt-1 break-all font-mono text-[10px] text-slate-700">{encryption.key_fingerprint}…</p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">Associated data (AAD)</div>
                  <p className="mt-1 break-all font-mono text-[10px] text-slate-700">{encryption.associated_data}</p>
                </div>
              </div>
            )}
          </div>

          <FlowArrow />

          {/* ── STEP 3: Steganography ── */}
          <div className="rounded-xl border border-slate-200 bg-mist/40 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500 mb-3">
              <Binary className="h-3 w-3 text-aqua" />
              Hidden in the cover image (QIM-LSB)
            </div>

            {!stego ? (
              <p className="text-[11px] text-slate-400">Select a cover image to see the steganography details.</p>
            ) : (
              <div className="space-y-3">
                {/* Stego image */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="relative h-36">
                    <ImagePreview source={image} alt="Stego image" className="h-full w-full object-contain" />
                    <div className="absolute inset-0 flex items-end justify-between p-2">
                      <span className="rounded-md bg-ink/80 px-1.5 py-0.5 text-[10px] font-bold text-aqua">
                        {stego.image_width}×{stego.image_height}
                      </span>
                      {downloadUrl && (
                        <a
                          href={downloadUrl}
                          download="stegocrypt-preview.png"
                          className="inline-flex items-center gap-1 rounded-md bg-ink/80 px-1.5 py-0.5 text-[10px] font-bold text-white hover:text-aqua"
                        >
                          <Download className="h-2.5 w-2.5" />PNG
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 px-2.5 py-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{stego.bits_embedded.toLocaleString()} bits embedded</span>
                      <span className="font-semibold text-aqua">{utilization}% capacity</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-aqua transition-all" style={{ width: `${Math.max(utilization, 1)}%` }} />
                    </div>
                  </div>
                </div>

                {/* SCQ1 Header */}
                <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">SCQ1 header (16 B)</div>
                  <p className="mt-1 break-all font-mono text-[10px] leading-4 text-ink">{stego.header_hex}</p>
                  <p className="mt-1 text-[9px] text-slate-500">
                    magic SCQ1 · v{stego.header.version} · q{stego.header.quantizer_id} · {stego.header.payload_length} B payload · CRC32 {stego.header.payload_crc32.toString(16).padStart(8, '0')}
                  </p>
                </div>

                {/* Embedding stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">Samples changed</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink">{stego.modified_samples.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">Mean shift</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink">{stego.mean_abs_delta}/255</div>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">QIM delta (δ)</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink">{stego.qim_delta}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">Container</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink">{stego.container_bytes.toLocaleString()} B</div>
                  </div>
                </div>

                {/* First bits sample */}
                <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">
                    <Fingerprint className="h-2.5 w-2.5" />First bits in LSB band
                  </div>
                  <p className="mt-1 break-all font-mono text-[10px] leading-5 text-ink">{stego.bits_sample}</p>
                </div>

                {/* Bit placement table */}
                <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
                  <div className="flex items-center gap-1 border-b border-slate-100 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">
                    <ScanLine className="h-2.5 w-2.5" />
                    Where the first {stego.bit_placements.length} bits land
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-50 text-[9px] uppercase tracking-[.08em] text-slate-400">
                        <tr>
                          <th className="px-2 py-1.5 font-bold">Bit</th>
                          <th className="px-2 py-1.5 font-bold">Pixel</th>
                          <th className="px-2 py-1.5 font-bold">Ch.</th>
                          <th className="px-2 py-1.5 font-bold">Val</th>
                          <th className="px-2 py-1.5 font-bold">→QIM</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-ink">
                        {stego.bit_placements.map((p) => (
                          <tr key={p.index} className="border-t border-slate-50">
                            <td className="px-2 py-1">{p.index}</td>
                            <td className="px-2 py-1 text-slate-500">{p.pixel}</td>
                            <td className="px-2 py-1">
                              <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded text-[8px] font-bold ${CHANNEL_STYLES[p.channel]}`}>
                                {p.channel}
                              </span>
                            </td>
                            <td className="px-2 py-1 font-bold text-aqua">{p.bit}</td>
                            <td className="px-2 py-1 text-slate-500">{p.original}→{p.quantized}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-[10px] leading-5 text-slate-400">
                  Each bit rewrites one RGB channel to the nearest even/odd QIM level (δ={stego.qim_delta}). The first 16 bytes are the SCQ1 header; the rest is the SCEP ciphertext envelope. Only the lossless PNG preserves the payload.
                </p>
              </div>
            )}
          </div>

          {/* Flow summary */}
          {stego && (
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-navy/5 to-aqua/5 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-navy">
                <Shuffle className="h-3 w-3" />
                What gets sent
              </div>
              <div className="mt-2 flex flex-col gap-1 text-[11px] text-slate-600">
                <span>✦ <strong>{new TextEncoder().encode(plaintext).length} B</strong> plaintext → AES-256-GCM</span>
                <span>✦ <strong>{encryption?.payload_bytes} B</strong> SCEP payload (ciphertext + nonce + tag + header)</span>
                <span>✦ <strong>{stego.bits_embedded.toLocaleString()} bits</strong> hidden across <strong>{stego.modified_samples.toLocaleString()}</strong> pixels</span>
                <span>✦ <strong>{stego.image_width}×{stego.image_height} PNG</strong> looks visually identical</span>
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-1">Preview built from your current draft only — nothing has been sent yet.</p>
        </div>
      )}
    </div>
  );
}

import { Binary, Download, Fingerprint, Image as ImageIcon, KeyRound, Lock, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ImagePreview } from './ImagePreview';
import type { MessagePreviewResponse } from '../types/api';

interface LivePreviewProps {
  preview?: MessagePreviewResponse;
  image?: Blob;
  isLoading: boolean;
  error?: unknown;
}

function HexBlock({ value, label, maxHeight = 'max-h-36' }: { value: string; label: string; maxHeight?: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{label}</div>
      <pre className={`mt-1 ${maxHeight} overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ink px-3 py-2 font-mono text-[11px] leading-5 text-aqua/90`}>{value}</pre>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-slate-400">{label}</span>
      <span className="break-all text-right font-mono text-xs text-ink">{value}</span>
    </div>
  );
}

const CHANNEL_STYLES: Record<string, string> = {
  R: 'bg-[#f7d9d4] text-[#9c3f2f]',
  G: 'bg-[#d7efe3] text-[#1d6b4a]',
  B: 'bg-[#dbe5f7] text-[#274a86]',
};

export function LivePreview({ preview, image, isLoading, error }: LivePreviewProps) {
  const [downloadUrl, setDownloadUrl] = useState<string>();

  useEffect(() => {
    if (!image) {
      setDownloadUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(image);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  if (error) {
    return <section className="mt-6 rounded-3xl border border-coral/30 bg-coral/5 p-5 text-sm text-[#9c3f2f] sm:p-7">
      <div className="flex items-center gap-2 font-bold"><ScanLine className="h-4 w-4" /> Live preview unavailable</div>
      <p className="mt-2 leading-6">{error instanceof Error ? error.message : 'The preview could not be built for this message and image.'}</p>
    </section>;
  }

  if (!preview) {
    return <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500">
      <ScanLine className="mx-auto h-6 w-6 text-aqua" />
      <p className="mt-2 font-semibold text-ink">Write a message and choose a cover image</p>
      <p className="mt-1 text-xs">The ciphertext and the exact bitstream hidden in the PNG will appear here before you send.</p>
    </section>;
  }

  const { encryption, stego } = preview;
  const utilization = stego ? Math.round(stego.capacity_utilization * 1000) / 10 : 0;

  return <section className="mt-6 animate-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-aqua">Live preview of this draft</p>
        <h2 className="mt-1 text-xl font-bold text-ink">What is encrypted and what is hidden in the image</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Built with a real signed X25519 handshake and AES-256-GCM encryption, then embedded with the same QIM quantizer the transfer uses. Each send negotiates a fresh key, so these exact bytes are rebuilt at transfer time.</p>
      </div>
      {isLoading && <span className="shrink-0 rounded-full bg-mist px-3 py-1.5 text-xs font-semibold text-navy">Rebuilding…</span>}
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-mist/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-ink"><Lock className="h-4 w-4 text-aqua" /> Encrypted message</div>
        <div className="mt-4 space-y-3">
          <Field label="Ciphertext bytes" value={encryption.ciphertext_hex.length / 2} />
          <Field label="Payload bytes" value={encryption.payload_bytes} />
          <Field label="Session key (SHA-256)" value={`${encryption.key_fingerprint}…`} />
          <HexBlock label="AES-256-GCM nonce (12 B)" value={encryption.nonce_hex} maxHeight="max-h-20" />
          <HexBlock label="Ciphertext (hex)" value={encryption.ciphertext_hex || '(empty message)'} />
          <HexBlock label="Authentication tag (16 B)" value={encryption.tag_hex} maxHeight="max-h-20" />
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400"><KeyRound className="h-3 w-3" /> Associated data</div>
            <p className="mt-1 break-all font-mono text-[11px] leading-4 text-slate-600">{encryption.associated_data}</p>
          </div>
          <Field label="Algorithm" value={encryption.algorithm} />
          <p className="text-xs leading-5 text-slate-500">The ciphertext plus the 16-byte tag and the SCEP header is the payload that gets hidden in the image. The plaintext is never part of the PNG.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-mist/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-ink"><Binary className="h-4 w-4 text-aqua" /> Steganographed in the image</div>
        {!stego ? <p className="mt-4 text-sm leading-6 text-slate-500">Choose a cover image to see the header, bit layout, and the exact PNG that carries the payload.</p> : <>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="relative h-44"><ImagePreview source={image} alt="Stego image with the encrypted payload embedded" className="h-full w-full object-contain" /></div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><ImageIcon className="h-3.5 w-3.5" /> {stego.image_width} × {stego.image_height} PNG · {stego.bits_embedded.toLocaleString()} bits</span>
              {downloadUrl && <a href={downloadUrl} download="stegocrypt-stego-preview.png" className="inline-flex items-center gap-1 text-[11px] font-bold text-navy underline decoration-aqua decoration-2 underline-offset-2 hover:text-aqua"><Download className="h-3.5 w-3.5" /> Download</a>}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>Capacity used</span><span>{utilization}% · {stego.required_bytes.toLocaleString()} / {stego.capacity_bytes.toLocaleString()} B</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-aqua" style={{ width: `${Math.max(utilization, 1)}%` }} /></div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">SCQ1 header (16 B)</div>
              <div className="mt-1 break-all font-mono text-[11px] leading-4 text-ink">{stego.header_hex}</div>
              <div className="mt-1 text-[11px] text-slate-500">magic SCQ1 · v{stego.header.version} · q{stego.header.quantizer_id} · {stego.header.payload_length} B payload · CRC32 {stego.header.payload_crc32.toString(16).padStart(8, '0')}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Embedding</div>
              <Field label="Container" value={`${stego.container_bytes.toLocaleString()} B`} />
              <Field label="Bits written" value={stego.bits_embedded.toLocaleString()} />
              <Field label="Samples changed" value={stego.modified_samples.toLocaleString()} />
              <Field label="Mean shift" value={`${stego.mean_abs_delta} / 255`} />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400"><Fingerprint className="h-3 w-3" /> First bits in the LSB band</div>
            <p className="mt-1 break-all font-mono text-[11px] leading-5 text-ink">{stego.bits_sample}</p>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400"><ScanLine className="h-3 w-3" /> Where the first {stego.bit_placements.length} bits land</div>
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[.1em] text-slate-400">
                <tr><th className="px-3 py-1.5 font-bold">Bit</th><th className="px-2 py-1.5 font-bold">Pixel</th><th className="px-2 py-1.5 font-bold">Ch.</th><th className="px-2 py-1.5 font-bold">Value</th><th className="px-3 py-1.5 font-bold">Sample → QIM</th></tr>
              </thead>
              <tbody className="font-mono text-ink">
                {stego.bit_placements.map((placement) => (
                  <tr key={placement.index} className="border-t border-slate-100">
                    <td className="px-3 py-1">{placement.index}</td>
                    <td className="px-2 py-1 text-slate-500">{placement.pixel}</td>
                    <td className="px-2 py-1"><span className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${CHANNEL_STYLES[placement.channel]}`}>{placement.channel}</span></td>
                    <td className="px-2 py-1 font-bold text-aqua">{placement.bit}</td>
                    <td className="px-3 py-1">{placement.original} → {placement.quantized}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Each bit rewrites one RGB channel to the nearest even or odd quantization level (δ = {stego.qim_delta}). The first 16 bytes are the SCQ1 header; the rest is the SCEP envelope shown on the left. Downloads and screenshots destroy the payload — only the lossless PNG keeps it.</p>
        </>}
      </div>
    </div>
    <p className="mt-4 text-[11px] text-slate-400">Preview is generated from your current draft only; nothing has been transferred yet.</p>
  </section>;
}

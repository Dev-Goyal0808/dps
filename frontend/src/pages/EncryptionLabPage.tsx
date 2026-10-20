import { Check, Clipboard, Fingerprint, FlaskConical, KeyRound, LockKeyhole, LoaderCircle, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ErrorAlert } from '../components/ErrorAlert';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../services/api';
import type { EncryptionAlgorithms, EncryptionDemoResponse } from '../types/api';

const SAMPLE_MESSAGE = 'The quietest signals can still carry a clear truth.';

export function EncryptionLabPage() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<EncryptionDemoResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const messageBytes = new TextEncoder().encode(message).length;

  const encryptMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      setError(new Error('Write a message before encrypting it.'));
      return;
    }

    setIsEncrypting(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.runEncryptionDemo(message));
    } catch (nextError) {
      setError(nextError);
    } finally {
      setIsEncrypting(false);
    }
  };

  const loadSample = () => {
    setMessage(SAMPLE_MESSAGE);
    setError(null);
    setResult(null);
  };

  const copyValue = async (field: string, value: string) => {
    await navigator.clipboard?.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1600);
  };

  return <div className="mx-auto max-w-7xl animate-fade-up px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
    <header className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-aqua"><FlaskConical className="h-4 w-4" /> Encryption Lab</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Encrypt a message. Inspect the proof.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Send one message through the demo endpoint and see the authenticated recovery, encoded payload, and cryptographic metadata in one place.</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-aqua" />Live encryption demo</div>
    </header>

    <div className="grid gap-6 lg:grid-cols-[.78fr_1.22fr] lg:items-start">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><div className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Step 01</div><h2 className="mt-1 text-xl font-bold text-ink">Compose a message</h2></div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mist text-navy"><MessageSquareText className="h-5 w-5" /></span>
        </div>
        <form className="mt-7" onSubmit={encryptMessage}>
          <label className="block" htmlFor="encryption-message"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">Message to encrypt</span><span className="text-xs font-semibold text-slate-400">{messageBytes.toLocaleString()} bytes</span></div><textarea id="encryption-message" value={message} onChange={(event) => { setMessage(event.target.value); setError(null); }} rows={9} placeholder="Write a message to protect…" className="field resize-none leading-6" /></label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-slate-400">The service encrypts and verifies this text for the demo.</p><button type="button" onClick={loadSample} className="text-xs font-bold text-navy underline decoration-aqua underline-offset-4 hover:text-aqua">Use sample message</button></div>
          <button type="submit" disabled={!message.trim() || isEncrypting} className="button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-40">{isEncrypting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Encrypting and verifying…</> : <><LockKeyhole className="h-4 w-4" /> Encrypt message</>}</button>
        </form>
        {isEncrypting && <p role="status" aria-live="polite" className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-aqua" /> Waiting for the verified recovery result…</p>}
        {Boolean(error) && <div className="mt-5"><ErrorAlert error={error} onDismiss={() => setError(null)} /></div>}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7" aria-live="polite">
         <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Step 02</div><h2 className="mt-1 text-xl font-bold text-ink">Verified output</h2></div>{result && <StatusBadge status={result.recovery_status} label="Verified" compact />}</div>
        {!result ? <EmptyResult /> : <EncryptionResult result={result} copiedField={copiedField} onCopy={copyValue} />}
      </section>
    </div>

    <aside className="mt-6 flex items-start gap-3 rounded-3xl border border-gold/35 bg-gold/10 p-5 text-sm leading-6 text-[#725500] sm:p-6"><Sparkles className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Encryption-only demo:</strong> Steganography is intentionally disabled and is not part of this demo. No image embedding, hidden payload, or transfer workflow happens here.</p></aside>
  </div>;
}

function EmptyResult() {
  return <div className="flex min-h-[31rem] flex-col items-center justify-center px-4 text-center"><div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-navy text-aqua shadow-lg shadow-navy/15"><ShieldCheck className="h-8 w-8" /><span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-aqua" /></div><h3 className="mt-6 text-lg font-bold text-ink">Your proof will appear here</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">The recovered message, ciphertext, nonce, fingerprints, and algorithm choices are shown after encryption completes.</p></div>;
}

function EncryptionResult({ result, copiedField, onCopy }: { result: EncryptionDemoResponse; copiedField: string | null; onCopy: (field: string, value: string) => void }) {
   const algorithms = formatAlgorithms(result.algorithm_details);
   return <div className="mt-6 space-y-6">
     <div className="rounded-2xl border border-aqua/25 bg-aqua/8 p-5"><div className="flex items-center gap-2 text-sm font-bold text-[#087d73]"><Check className="h-4 w-4" /> Verified recovery</div><p className="mt-3 whitespace-pre-wrap text-base leading-7 text-ink">{result.recovered_message}</p></div>

     <div><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-aqua">Payload inspection</p><h3 className="mt-1 text-base font-bold text-ink">Encoded message material</h3></div><span className="rounded-full bg-mist px-3 py-1 text-xs font-bold text-slate-500">{formatBytes(result.payload_bytes)}</span></div><div className="grid gap-3 sm:grid-cols-2"><EncodedValue label="Ciphertext · base64" value={result.ciphertext} field="ciphertext" copiedField={copiedField} onCopy={onCopy} /><EncodedValue label="Nonce · base64" value={result.nonce} field="nonce" copiedField={copiedField} onCopy={onCopy} /></div></div>

    <div><div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><KeyRound className="h-4 w-4 text-aqua" /> Algorithms</div><div className="flex flex-wrap gap-2">{algorithms.map((algorithm) => <span key={algorithm} className="rounded-full border border-slate-200 bg-mist/70 px-3 py-1.5 text-xs font-bold text-navy">{algorithm}</span>)}</div></div>

    <div className="grid gap-3 sm:grid-cols-2"><FingerprintValue label="Sender fingerprint" value={result.sender_fingerprint} /><FingerprintValue label="Receiver fingerprint" value={result.receiver_fingerprint} /></div>
     <div className="rounded-2xl bg-mist/70 p-4"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Transcript hash</div><div className="mt-2 break-all font-mono text-xs leading-5 text-ink">{result.transcript_hash}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span>Message ID: <strong className="font-mono text-ink">{result.message_id}</strong></span><span>Status: <strong className="text-ink">{result.recovery_status}</strong></span></div></div>
  </div>;
}

function EncodedValue({ label, value, field, copiedField, onCopy }: { label: string; value: string; field: string; copiedField: string | null; onCopy: (field: string, value: string) => void }) {
  return <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex items-center justify-between gap-2"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{label}</div><button type="button" aria-label={`Copy ${field}`} onClick={() => onCopy(field, value)} className="icon-button" title={`Copy ${field}`}><Clipboard className="h-4 w-4" /></button></div><div className="mt-3 max-h-24 overflow-y-auto break-all font-mono text-xs leading-5 text-ink">{value}</div>{copiedField === field && <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#087d73]"><Check className="h-3 w-3" /> Copied</div>}</div>;
}

function FingerprintValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400"><Fingerprint className="h-3.5 w-3.5 text-aqua" /> {label}</div><div className="mt-3 break-all font-mono text-xs leading-5 text-ink">{value}</div></div>;
}

function formatAlgorithms(algorithms: EncryptionAlgorithms) {
   return Object.entries(algorithms).map(([name, value]) => `${humanize(name)} · ${value}`);
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatBytes(bytes: number) {
  return `${bytes.toLocaleString()} bytes`;
}

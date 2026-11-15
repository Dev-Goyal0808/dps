import {
  Check,
  Clipboard,
  Fingerprint,
  FlaskConical,
  KeyRound,
  LockKeyhole,
  LoaderCircle,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../services/api';
import type { EncryptionChannelResponse, EncryptionReceiveResponse, EncryptionSendResponse } from '../types/api';

const SAMPLE_MESSAGE = 'The quietest signals can still carry a clear truth.';

export function EncryptionLabPage() {
  const [channel, setChannel] = useState<EncryptionChannelResponse | null>(null);
  const [message, setMessage] = useState('');
  const [envelope, setEnvelope] = useState<EncryptionSendResponse | null>(null);
  const [decrypted, setDecrypted] = useState<EncryptionReceiveResponse | null>(null);
  const [channelError, setChannelError] = useState<unknown>(null);
  const [sendError, setSendError] = useState<unknown>(null);
  const [receiveError, setReceiveError] = useState<unknown>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const didInitialize = useRef(false);
  const messageBytes = new TextEncoder().encode(message).length;

  const createChannel = useCallback(async () => {
    setIsCreating(true);
    setChannelError(null);
    setSendError(null);
    setReceiveError(null);
    setChannel(null);
    setEnvelope(null);
    setDecrypted(null);
    try {
      setChannel(await api.createEncryptionChannel());
    } catch (error) {
      setChannelError(error);
    } finally {
      setIsCreating(false);
    }
  }, []);

  useEffect(() => {
    if (didInitialize.current) return;
    didInitialize.current = true;
    void createChannel();
  }, [createChannel]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!channel || !message.trim()) {
      setSendError(new Error('Write a message before encrypting it.'));
      return;
    }

    setIsSending(true);
    setSendError(null);
    setReceiveError(null);
    setEnvelope(null);
    setDecrypted(null);
    try {
      setEnvelope(await api.sendEncryptedMessage(channel.sender_token, channel.session_id, message));
    } catch (error) {
      setSendError(error);
    } finally {
      setIsSending(false);
    }
  };

  const decryptMessage = async () => {
    if (!channel || !envelope) return;

    setIsDecrypting(true);
    setReceiveError(null);
    setDecrypted(null);
    try {
      const result = await api.receiveEncryptedMessage(
        channel.receiver_token,
        channel.session_id,
        envelope.message_id,
        envelope.serialized_payload,
      );
      if (result.recovery_status !== 'verified') {
        throw new Error('The recovered payload could not be authenticated. Plaintext is unavailable.');
      }
      setDecrypted(result);
    } catch (error) {
      setReceiveError(error);
    } finally {
      setIsDecrypting(false);
    }
  };

  const loadSample = () => {
    setMessage(SAMPLE_MESSAGE);
    setSendError(null);
    setReceiveError(null);
    setEnvelope(null);
    setDecrypted(null);
  };

  const copyValue = async (field: string, value: string) => {
    await navigator.clipboard?.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1600);
  };

  const channelStatus = isCreating ? 'creating' : channel ? (decrypted ? 'verified' : envelope ? 'stored' : 'connected') : 'failed';

  return <div className="mx-auto max-w-7xl animate-fade-up px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
    <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-aqua"><FlaskConical className="h-4 w-4" /> Encryption Lab</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Split the message. Verify the proof.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Run the sender and receiver as separate clients. Inspect the encrypted envelope in transit, then decrypt it only after the receiver authenticates the payload.</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className={`h-2 w-2 rounded-full ${isCreating ? 'animate-pulse bg-gold' : 'animate-pulse bg-aqua'}`} />Ephemeral channel</div>
    </header>

    <ChannelCard channel={channel} status={channelStatus} isCreating={isCreating} error={channelError} onCreate={() => void createChannel()} />

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <SenderPanel
        channel={channel}
        message={message}
        messageBytes={messageBytes}
        envelope={envelope}
        copiedField={copiedField}
        isSending={isSending}
        error={sendError}
        onMessageChange={(value) => { setMessage(value); setSendError(null); }}
        onSubmit={sendMessage}
        onSample={loadSample}
        onCopy={copyValue}
        onDismissError={() => setSendError(null)}
      />
      <ReceiverPanel
        channel={channel}
        envelope={envelope}
        decrypted={decrypted}
        copiedField={copiedField}
        isDecrypting={isDecrypting}
        error={receiveError}
        onDecrypt={() => void decryptMessage()}
        onCopy={copyValue}
        onDismissError={() => setReceiveError(null)}
      />
    </div>

    {channel && <MetadataCard channel={channel} />}

    <div className="mt-6 flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-500 shadow-soft sm:p-6"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-aqua" /><p><strong className="text-ink">Encryption-only channel:</strong> role credentials stay in memory for this demo, and the transport carries an authenticated encrypted envelope without image embedding or hidden payloads. To see the full pipeline, <Link to="/about" className="font-bold text-navy underline decoration-aqua decoration-2 underline-offset-4">read how it works</Link> or <Link to="/receive" className="font-bold text-navy underline decoration-aqua decoration-2 underline-offset-4">open a receiving room</Link>.</p></div>
  </div>;
}

function ChannelCard({ channel, status, isCreating, error, onCreate }: { channel: EncryptionChannelResponse | null; status: string; isCreating: boolean; error: unknown; onCreate: () => void }) {
  return <section className="rounded-3xl bg-navy p-5 text-white shadow-panel sm:p-7">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-aqua"><KeyRound className="h-4 w-4" /> Channel / session</div>
        <h2 className="mt-2 text-xl font-bold">One session, two authenticated roles</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">The demo creates separate sender and receiver credentials. They are used only for this in-memory channel and never persisted by the client.</p>
      </div>
      <StatusBadge status={status} label={isCreating ? 'Creating channel' : status === 'failed' ? 'Unavailable' : status === 'connected' ? 'Channel ready' : status === 'stored' ? 'Envelope stored' : status === 'verified' ? 'Verified' : undefined} />
    </div>
    {Boolean(error) && <div className="mt-5"><ErrorAlert error={error} title="Could not create the demo channel" onRetry={onCreate} /></div>}
    {isCreating && <div role="status" aria-live="polite" className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-300"><LoaderCircle className="h-4 w-4 animate-spin text-aqua" /> Establishing the sender and receiver identities…</div>}
    {channel && <div className="mt-6 grid gap-3 sm:grid-cols-[1.25fr_.75fr_.75fr]">
      <InfoValue dark label="Session ID" value={channel.session_id} mono />
      <InfoValue dark label="Expires" value={formatExpiry(channel.expires_at)} />
      <InfoValue dark label="Role tokens" value="2 in memory" />
    </div>}
  </section>;
}

function SenderPanel({ channel, message, messageBytes, envelope, copiedField, isSending, error, onMessageChange, onSubmit, onSample, onCopy, onDismissError }: { channel: EncryptionChannelResponse | null; message: string; messageBytes: number; envelope: EncryptionSendResponse | null; copiedField: string | null; isSending: boolean; error: unknown; onMessageChange: (value: string) => void; onSubmit: (event: FormEvent) => void; onSample: () => void; onCopy: (field: string, value: string) => void; onDismissError: () => void }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
    <RoleHeading step="01" role="Client Sender" description="Encrypt and send without exposing plaintext to the transport." icon={<Send className="h-5 w-5" />} tone="navy" />
    <div className="mt-6 flex items-center gap-2 rounded-2xl bg-mist/70 px-4 py-3 text-xs font-semibold text-slate-600"><UserRound className="h-4 w-4 text-navy" /> Sender identity <span className="ml-auto font-mono text-[10px] text-slate-400">{channel?.sender_fingerprint ?? 'awaiting channel'}</span></div>
    <form className="mt-6" onSubmit={onSubmit}>
      <label className="block" htmlFor="encryption-message"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">Message to protect</span><span className="text-xs font-semibold text-slate-400">{messageBytes.toLocaleString()} bytes</span></div><textarea id="encryption-message" value={message} onChange={(event) => onMessageChange(event.target.value)} disabled={!channel || isSending} rows={7} placeholder="Write a message to protect…" className="field resize-none leading-6" /></label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-slate-400">The sender receives ciphertext and envelope metadata only.</p><button type="button" onClick={onSample} className="text-xs font-bold text-navy underline decoration-aqua underline-offset-4 hover:text-aqua">Use sample message</button></div>
      <button type="submit" disabled={!channel || !message.trim() || isSending} className="button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-40">{isSending ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Encrypting and sending…</> : <><LockKeyhole className="h-4 w-4" /> Encrypt &amp; Send</>}</button>
    </form>
    {isSending && <p role="status" aria-live="polite" className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-aqua" /> Sealing the message into an authenticated envelope…</p>}
    {Boolean(error) && <div className="mt-5"><ErrorAlert error={error} title="The sender could not encrypt the message" onDismiss={onDismissError} /></div>}
    {envelope && <div className="mt-7 animate-fade-up"><EnvelopeCard title="Encrypted envelope" subtitle="Sender output · no plaintext returned" envelope={envelope} copiedField={copiedField} onCopy={onCopy} /></div>}
  </section>;
}

function ReceiverPanel({ channel, envelope, decrypted, copiedField, isDecrypting, error, onDecrypt, onCopy, onDismissError }: { channel: EncryptionChannelResponse | null; envelope: EncryptionSendResponse | null; decrypted: EncryptionReceiveResponse | null; copiedField: string | null; isDecrypting: boolean; error: unknown; onDecrypt: () => void; onCopy: (field: string, value: string) => void; onDismissError: () => void }) {
  const hasError = Boolean(error);
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
    <RoleHeading step="02" role="Client Receiver" description="Receive the envelope, then explicitly authenticate and decrypt it." icon={<ShieldCheck className="h-5 w-5" />} tone="aqua" />
    <div className="mt-6 flex items-center gap-2 rounded-2xl bg-aqua/8 px-4 py-3 text-xs font-semibold text-[#087d73]"><UserRound className="h-4 w-4" /> Receiver identity <span className="ml-auto font-mono text-[10px] text-[#087d73]/70">{channel?.receiver_fingerprint ?? 'awaiting channel'}</span></div>
    {!envelope ? <EmptyReceiver /> : <div className="mt-6 animate-fade-up"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-aqua">Received envelope</p><h3 className="mt-1 text-base font-bold text-ink">Ready for receiver authentication</h3></div><StatusBadge status={decrypted ? 'verified' : hasError ? 'rejected' : 'pending'} label={decrypted ? 'Verified' : hasError ? 'Rejected' : 'Awaiting decrypt'} compact /></div><EnvelopeCard title="Payload in receiver memory" subtitle="Copied from the sender result for verification" envelope={envelope} copiedField={copiedField} onCopy={onCopy} /><button type="button" onClick={onDecrypt} disabled={isDecrypting || Boolean(decrypted)} className="button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40">{isDecrypting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Authenticating &amp; decrypting…</> : decrypted ? <><Check className="h-4 w-4" /> Plaintext verified</> : <><KeyRound className="h-4 w-4" /> Decrypt</>}</button>{isDecrypting && <p role="status" aria-live="polite" className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-aqua" /> Receiver is checking the authentication tag…</p>}{hasError && <div className="mt-5"><ErrorAlert error={error} title="Recovery rejected" onDismiss={onDismissError} /><p className="mt-3 text-xs leading-5 text-slate-500">Plaintext stays hidden because this envelope was not authenticated.</p></div>}{decrypted && <div className="mt-5 rounded-2xl border border-aqua/30 bg-aqua/8 p-5"><div className="flex items-center gap-2 text-sm font-bold text-[#087d73]"><Check className="h-4 w-4" /> Verified plaintext</div><p className="mt-3 whitespace-pre-wrap text-base leading-7 text-ink">{decrypted.plaintext}</p><p className="mt-4 text-xs font-semibold text-[#087d73]">Authentication passed · message {decrypted.message_id}</p></div>}</div>}
  </section>;
}

function EmptyReceiver() {
  return <div className="flex min-h-[25rem] flex-col items-center justify-center px-4 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-navy"><ShieldCheck className="h-7 w-7" /></div><h3 className="mt-5 text-lg font-bold text-ink">Waiting for the sender</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">When the sender encrypts a message, its ciphertext envelope will appear here. Plaintext stays hidden until you click Decrypt.</p></div>;
}

function EnvelopeCard({ title, subtitle, envelope, copiedField, onCopy }: { title: string; subtitle: string; envelope: EncryptionSendResponse; copiedField: string | null; onCopy: (field: string, value: string) => void }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-aqua">{title}</p><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><span className="rounded-full bg-mist px-3 py-1 text-xs font-bold text-slate-500">{formatBytes(envelope.payload_bytes)}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><EncodedValue label="Ciphertext · base64" value={envelope.ciphertext} field={`${title}-ciphertext`} copiedField={copiedField} onCopy={onCopy} /><EncodedValue label="Serialized envelope · base64" value={envelope.serialized_payload} field={`${title}-envelope`} copiedField={copiedField} onCopy={onCopy} /><EncodedValue label="Nonce · base64" value={envelope.nonce} field={`${title}-nonce`} copiedField={copiedField} onCopy={onCopy} /></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span>Message ID: <strong className="font-mono text-ink">{envelope.message_id}</strong></span><span>Status: <strong className="text-ink">{envelope.status}</strong></span></div></div>;
}

function MetadataCard({ channel }: { channel: EncryptionChannelResponse }) {
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-aqua">Shared proof metadata</p><h2 className="mt-1 text-xl font-bold text-ink">Both clients agree on the same channel</h2></div><div className="text-xs font-semibold text-slate-400">Transcript hash binds the session</div></div><div className="mt-6 grid gap-3 lg:grid-cols-2"><FingerprintValue label="Sender fingerprint" value={channel.sender_fingerprint} /><FingerprintValue label="Receiver fingerprint" value={channel.receiver_fingerprint} /></div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.25fr]"><div className="rounded-2xl bg-mist/70 p-4"><div className="flex items-center gap-2 text-sm font-bold text-ink"><Fingerprint className="h-4 w-4 text-aqua" /> Transcript hash</div><div className="mt-3 break-all font-mono text-xs leading-5 text-ink">{channel.transcript_hash}</div></div><div><div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><KeyRound className="h-4 w-4 text-aqua" /> Algorithms</div><div className="flex flex-wrap gap-2">{formatAlgorithms(channel.algorithm_details).map((algorithm) => <span key={algorithm} className="rounded-full border border-slate-200 bg-mist/70 px-3 py-1.5 text-xs font-bold text-navy">{algorithm}</span>)}</div></div></div></section>;
}

function RoleHeading({ step, role, description, icon, tone }: { step: string; role: string; description: string; icon: ReactNode; tone: 'navy' | 'aqua' }) {
  return <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Step {step}</div><h2 className="mt-1 text-xl font-bold text-ink">{role}</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p></div><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone === 'navy' ? 'bg-mist text-navy' : 'bg-aqua/10 text-[#087d73]'}`}>{icon}</span></div>;
}

function EncodedValue({ label, value, field, copiedField, onCopy }: { label: string; value: string; field: string; copiedField: string | null; onCopy: (field: string, value: string) => void }) {
  return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</div><button type="button" aria-label={`Copy ${label}`} onClick={() => onCopy(field, value)} className="icon-button" title={`Copy ${label}`}><Clipboard className="h-3.5 w-3.5" /></button></div><div className="mt-2 max-h-20 overflow-y-auto break-all font-mono text-[11px] leading-5 text-ink">{value}</div>{copiedField === field && <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#087d73]"><Check className="h-3 w-3" /> Copied</div>}</div>;
}

function FingerprintValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400"><Fingerprint className="h-3.5 w-3.5 text-aqua" /> {label}</div><div className="mt-3 break-all font-mono text-xs leading-5 text-ink">{value}</div></div>;
}

function InfoValue({ label, value, mono = false, dark = false }: { label: string; value: string; mono?: boolean; dark?: boolean }) {
  return <div className={`rounded-2xl p-4 ${dark ? 'border border-white/10 bg-white/[.08]' : 'border border-slate-200 bg-slate-50/70'}`}><div className={`text-[10px] font-bold uppercase tracking-[.14em] ${dark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</div><div className={`mt-2 break-all text-xs ${mono ? 'font-mono' : 'font-semibold'} ${dark ? 'text-white' : 'text-ink'}`}>{value}</div></div>;
}

function formatAlgorithms(algorithms: Record<string, string>) {
  return Object.entries(algorithms).map(([name, value]) => `${humanize(name)} · ${value}`);
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatExpiry(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number) {
  return `${bytes.toLocaleString()} bytes`;
}

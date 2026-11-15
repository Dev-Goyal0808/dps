import { ArrowRight, Check, Copy, Fingerprint, KeyRound, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { ImagePreview } from '../components/ImagePreview';
import { MetricCard } from '../components/MetricCard';
import { metricIcons } from '../components/metricIcons';
import { ProgressTimeline } from '../components/ProgressTimeline';
import { StatusBadge } from '../components/StatusBadge';
import { useSessions } from '../context/SessionContext';
import { useSessionStatus } from '../hooks/useSessionStatus';
import { api } from '../services/api';
import type { MessageResult } from '../types/api';

function formatExpiry(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMetric(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

export function ReceiveMessagePage() {
  const { receiverSession, setReceiverSession } = useSessions();
  const [session, setSession] = useState(receiverSession);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);
  const [result, setResult] = useState<MessageResult | null>(null);
  const [resultError, setResultError] = useState<unknown>(null);
  const [receivedImage, setReceivedImage] = useState<Blob>();
  const [copied, setCopied] = useState<'code' | 'session' | null>(null);
  const { status, isLoading, error: statusError, refresh } = useSessionStatus(session?.sessionId, session?.token);

  useEffect(() => {
    if (!session || status?.phase !== 'completed' || !status.message_id || result?.message_id === status.message_id) return;
    let cancelled = false;
    setResultError(null);
    const token = session.token;
    void api.getMessageResult(status.message_id, token).then((nextResult) => {
      if (cancelled) return;
      setResult(nextResult);
      setSession((current) => current ? { ...current, messageId: nextResult.message_id } : current);
      setReceiverSession({ ...session, messageId: nextResult.message_id });
    }).catch((error) => { if (!cancelled) setResultError(error); });
    return () => { cancelled = true; };
  }, [result?.message_id, session, setReceiverSession, status?.message_id, status?.phase]);

  // Load the authorized image separately. The result effect above re-runs when
  // `session` gains a message ID, which would cancel an in-flight image request.
  const verifiedMessageId = result?.recovery_status === 'verified' ? result.message_id : undefined;
  const receiverToken = session?.token;
  useEffect(() => {
    if (!verifiedMessageId || !receiverToken) return;
    let cancelled = false;
    void api.getMessageImage(verifiedMessageId, receiverToken).then((image) => {
      if (!cancelled) setReceivedImage(image);
    }).catch((error) => { if (!cancelled) setResultError(error); });
    return () => { cancelled = true; };
  }, [receiverToken, verifiedMessageId]);

  const createSession = async () => {
    setIsCreating(true); setCreateError(null); setResult(null); setResultError(null); setReceivedImage(undefined);
    try {
      const response = await api.createReceiverSession();
      const nextSession = {
        sessionId: response.session_id,
        token: response.receiver_token,
        role: 'receiver' as const,
        joinCode: response.join_code,
        expiresAt: response.expires_at,
        fingerprint: response.receiver_fingerprint,
      };
      setSession(nextSession); setReceiverSession(nextSession);
    } catch (error) {
      setCreateError(error);
    } finally { setIsCreating(false); }
  };

  const copyValue = async (kind: 'code' | 'session', value: string) => {
    await navigator.clipboard?.writeText(value);
    setCopied(kind); window.setTimeout(() => setCopied(null), 1500);
  };

  const startOver = () => { setSession(undefined); setReceiverSession(undefined); setResult(null); setResultError(null); setReceivedImage(undefined); };
  const metrics = result?.metrics;

  return <div className="mx-auto max-w-7xl animate-fade-up px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
    <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-aqua">Receiver endpoint</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Receive a verified message</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Create a temporary room and share the pairing details with your sender. Plaintext remains gated until authentication succeeds.</p></div>{session && <button type="button" onClick={startOver} className="button-secondary self-start sm:self-auto"><Plus className="h-4 w-4" /> New session</button>}</div>
    {!session ? <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-3xl bg-navy p-7 text-white shadow-panel sm:p-10"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-aqua/15 text-aqua"><KeyRound className="h-6 w-6" /></div><h2 className="mt-7 text-2xl font-extrabold tracking-tight">Open a private receiving room</h2><p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">The backend creates a short-lived session, a one-time join code, and a receiver identity fingerprint. Keep this tab open while your sender pairs.</p><button type="button" onClick={createSession} disabled={isCreating} className="mt-8 button-primary">{isCreating ? 'Creating session…' : <>Create receiving session <RefreshCw className="h-4 w-4" /></>}</button>{Boolean(createError) && <div className="mt-6"><ErrorAlert error={createError} /></div>}</section><section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">What happens next</p><div className="mt-6 space-y-5"><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-bold text-navy">1</span><p className="text-sm leading-6 text-slate-600">Share the session ID and join code with the sender.</p></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-bold text-navy">2</span><p className="text-sm leading-6 text-slate-600">Watch the authenticated transfer phases in real time.</p></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-xs font-bold text-navy">3</span><p className="text-sm leading-6 text-slate-600">Read plaintext only after the result is verified.</p></div></div><div className="mt-8 rounded-2xl bg-gold/10 p-4 text-xs leading-5 text-[#806000]">Compare the receiver fingerprint through an independent channel when identity verification matters.</div></section></div> : <div className="space-y-6"><section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:grid-cols-[1.15fr_.85fr] sm:p-7"><div><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-aqua/10 text-aqua"><ShieldCheck className="h-4 w-4" /></span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Your pairing details</p><h2 className="text-lg font-bold text-ink">Share securely</h2></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-mist/70 p-4"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Join code</div><div className="mt-2 flex items-center justify-between gap-2"><span className="font-mono text-2xl font-extrabold tracking-[.18em] text-ink">{session.joinCode}</span><button type="button" className="icon-button" aria-label="Copy join code" onClick={() => session.joinCode && copyValue('code', session.joinCode)}><Copy className="h-4 w-4" /></button></div><p className="mt-2 text-xs text-slate-500">Expires at {session.expiresAt ? formatExpiry(session.expiresAt) : 'the session timeout'}.</p></div><div className="rounded-2xl bg-mist/70 p-4"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">Session ID</div><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate font-mono text-xs font-bold text-ink">{session.sessionId}</span><button type="button" className="icon-button" aria-label="Copy session ID" onClick={() => copyValue('session', session.sessionId)}><Copy className="h-4 w-4" /></button></div><p className="mt-2 text-xs text-slate-500">Expires with the temporary room.</p></div></div><p className="mt-4 text-xs leading-5 text-slate-500">Sending from this browser? Open the <Link to="/send" className="font-bold text-navy underline decoration-aqua decoration-2 underline-offset-4">Send page</Link> in another tab and pair with these details.</p></div><div className="border-t border-slate-200 pt-5 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-slate-400"><Fingerprint className="h-4 w-4 text-aqua" /> Receiver identity</div><p className="mt-3 break-all font-mono text-xs leading-5 text-ink">{session.fingerprint ?? 'Fingerprint returned by backend at session creation.'}</p><p className="mt-3 text-xs leading-5 text-slate-500">Compare this fingerprint through an independent channel before sending sensitive content.</p></div></section>
      <section className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7 lg:grid-cols-[.75fr_1.25fr]"><div><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Live workflow</p><h2 className="mt-1 text-xl font-bold text-ink">Receiver status</h2></div>{status && <StatusBadge status={status.phase} />}</div><div className="mt-6"><ProgressTimeline phase={status?.phase ?? 'waiting'} progress={status?.progress ?? 0} /></div>{status?.updated_at && <p className="mt-6 text-xs text-slate-400">Updated {new Date(status.updated_at).toLocaleTimeString()}</p>}</div><div className="rounded-2xl bg-mist/60 p-5"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">Room state</div><div className="mt-2 text-lg font-bold text-ink">{status ? status.phase.replace(/_/g, ' ') : 'Waiting for sender'}</div></div>{isLoading && <RefreshCw className="h-4 w-4 animate-spin text-aqua" />}</div><p className="mt-3 text-sm leading-6 text-slate-600">{status?.phase === 'completed' ? 'The image arrived. Fetching the authorized result now.' : 'This page polls the status endpoint while the temporary session is active.'}</p><button type="button" onClick={() => void refresh()} className="mt-5 text-xs font-bold text-navy underline underline-offset-4">Refresh now</button>{Boolean(statusError) && <div className="mt-5"><ErrorAlert error={statusError} /></div>}</div></section>
      {result && result.recovery_status === 'verified' && typeof result.message === 'string' && <section className="rounded-3xl border border-aqua/30 bg-white p-5 shadow-soft sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-aqua text-white"><Check className="h-5 w-5" /></span><div><div className="flex items-center gap-2"><h2 className="text-xl font-bold text-ink">Verified plaintext</h2><StatusBadge status="verified" compact /></div><p className="mt-1 text-sm text-slate-500">Authenticated by the backend before display.</p></div></div><div className="flex flex-col items-start gap-2 sm:items-end"><div className="flex items-center gap-2 text-xs font-bold text-[#087d73]"><ShieldCheck className="h-4 w-4" /> AES-GCM authentication passed</div><Link to="/analysis" className="inline-flex items-center gap-1.5 text-xs font-bold text-navy underline decoration-aqua decoration-2 underline-offset-4 hover:text-aqua">Measure this transfer<ArrowRight className="h-3.5 w-3.5" /></Link></div></div><div className="mt-6 rounded-2xl bg-mist/70 p-5 text-base leading-8 text-ink whitespace-pre-wrap">{result.message}</div>{receivedImage && <div className="mt-6 grid gap-5 md:grid-cols-[.65fr_1.35fr] md:items-center"><div className="overflow-hidden rounded-2xl bg-slate-100"><ImagePreview source={receivedImage} alt="Received stego image" className="max-h-72 w-full" /></div><div><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Received image</p><p className="mt-2 text-sm leading-6 text-slate-600">The authorized PNG is available alongside the verified result. Metrics below are measured by the backend.</p></div></div>}</section>}
      {result && result.recovery_status !== 'verified' && <section className="rounded-3xl border border-coral/30 bg-white p-5 shadow-soft sm:p-7"><ErrorAlert error={result.error ?? new Error('The payload was not authenticated. Plaintext is unavailable.')} title="Recovery rejected" /><p className="mt-4 text-sm leading-6 text-slate-600">No recovered message is displayed because the backend did not report verified authentication.</p></section>}
      {Boolean(resultError) && <ErrorAlert error={resultError} title="Could not load the authorized result" />}
      {metrics && <section><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-aqua">Measured output</p><h2 className="mt-1 text-xl font-bold text-ink">Transfer and image metrics</h2></div><span className="text-xs text-slate-400">Backend measurements</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="PSNR" value={formatMetric(metrics.psnr, ' dB')} detail="Global RGB signal-to-noise · higher is better" icon={metricIcons.Image} tone="aqua" /><MetricCard label="SSIM" value={formatMetric(metrics.ssim)} detail="Structural similarity · saturates near 1 for small payloads" icon={metricIcons.Gauge} tone="navy" /><MetricCard label="Changed samples" value={formatMetric(metrics.changed_sample_ratio != null ? metrics.changed_sample_ratio * 100 : undefined, '%')} detail={`${formatMetric(metrics.changed_samples)} of ${formatMetric(metrics.total_samples)} RGB channels`} icon={metricIcons.Activity} tone="gold" /><MetricCard label="Throughput" value={formatMetric(metrics.throughput_bytes_per_second, ' B/s')} detail={formatMetric(metrics.transmission_time_ms, ' ms PNG transfer')} icon={metricIcons.Timer} tone="coral" /></div></section>}
    </div>}
    {copied && <div className="fixed bottom-6 right-6 rounded-xl bg-ink px-4 py-3 text-xs font-bold text-white shadow-panel">Copied {copied === 'code' ? 'join code' : 'session ID'}</div>}
  </div>;
}

import { ArrowRight, ClipboardPaste, FileCheck2, LockKeyhole, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { ImageDropzone } from '../components/ImageDropzone';
import { LivePreview } from '../components/LivePreview';
import { ProgressTimeline } from '../components/ProgressTimeline';
import { StatusBadge } from '../components/StatusBadge';
import { useSessions } from '../context/SessionContext';
import { useSessionStatus } from '../hooks/useSessionStatus';
import { api } from '../services/api';
import type { MessagePreviewResponse } from '../types/api';

const MAX_MESSAGE_BYTES = 256 * 1024;

export function SendMessagePage() {
  const { senderSession, setSenderSession } = useSessions();
  const [sessionId, setSessionId] = useState(senderSession?.sessionId ?? '');
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');
  const [coverImage, setCoverImage] = useState<File>();
  const [connectionError, setConnectionError] = useState<unknown>(null);
  const [sendError, setSendError] = useState<unknown>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(Boolean(senderSession));
  const [messageId, setMessageId] = useState(senderSession?.messageId);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<MessagePreviewResponse>();
  const [previewImage, setPreviewImage] = useState<Blob>();
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const { status, error: statusError } = useSessionStatus(senderSession?.sessionId, senderSession?.token, { enabled: isConnected });
  const messageBytes = new TextEncoder().encode(message).length;
  const canSend = Boolean(isConnected && message.trim() && coverImage && messageBytes <= MAX_MESSAGE_BYTES && !isSending);

  useEffect(() => {
    if (status?.message_id && status.message_id !== messageId) setMessageId(status.message_id);
  }, [messageId, status?.message_id]);

  const previewSession = senderSession;
  const previewMessage = message.trim() ? message : '';
  const canPreview = Boolean(isConnected && previewSession && coverImage && previewMessage && !messageId);

  useEffect(() => {
    if (!canPreview || !previewSession || !coverImage) {
      setPreview(undefined);
      setPreviewImage(undefined);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsPreviewLoading(true);
      setPreviewError(null);
      api.previewMessage(previewSession.token, previewSession.sessionId, previewMessage, coverImage)
        .then(async (response) => {
          if (cancelled) return;
          setPreview(response);
          if (!response.stego) {
            setPreviewImage(undefined);
            return;
          }
          const image = await api.getPreviewImage(response.preview_id, previewSession.token);
          if (!cancelled) setPreviewImage(image);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setPreviewError(error);
          setPreview(undefined);
          setPreviewImage(undefined);
        })
        .finally(() => {
          if (!cancelled) setIsPreviewLoading(false);
        });
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canPreview, previewSession, coverImage, previewMessage]);

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionId.trim() || joinCode.trim().length < 6) {
      setConnectionError(new Error('Enter the receiver session ID and its 8-character join code.'));
      return;
    }
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const response = await api.connectSender(sessionId.trim(), joinCode.trim().toUpperCase());
      setSenderSession({ sessionId: response.session_id, token: response.sender_token, role: 'sender' });
      setIsConnected(true);
    } catch (error) {
      setConnectionError(error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!senderSession || !coverImage || !message.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const response = await api.sendMessage(senderSession.token, senderSession.sessionId, message, coverImage);
      setMessageId(response.message_id);
      setSenderSession({ ...senderSession, messageId: response.message_id });
    } catch (error) {
      setSendError(error);
    } finally {
      setIsSending(false);
    }
  };

  const reset = () => {
    setSenderSession(undefined);
    setSessionId(''); setJoinCode(''); setMessage(''); setCoverImage(undefined); setMessageId(undefined); setIsConnected(false); setConnectionError(null); setSendError(null); setPreview(undefined); setPreviewImage(undefined); setPreviewError(null);
  };

  const copySessionId = async () => {
    await navigator.clipboard?.writeText(sessionId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return <div className="mx-auto max-w-7xl animate-fade-up px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
    <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-aqua">Sender endpoint</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Send a protected message</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Pair with a receiver, choose a cover image, and let the backend handle encryption and embedding.</p></div><div className="flex flex-col items-start gap-2 text-xs font-semibold text-slate-500 sm:items-end"><span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-aqua" />Temporary credentials stay in memory</span><Link to="/receive" className="inline-flex items-center gap-1 font-bold text-navy underline decoration-aqua decoration-2 underline-offset-4 hover:text-aqua">Need a room? Start on Receive<ArrowRight className="h-3.5 w-3.5" /></Link></div></div>
    <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7"><div className="flex items-start justify-between"><div><div className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Step 01</div><h2 className="mt-1 text-xl font-bold text-ink">Pair with receiver</h2></div>{isConnected ? <StatusBadge status="connected" /> : <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">Not paired</span>}</div>
        <form className="mt-7 space-y-5" onSubmit={handleConnect}><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-slate-500">Session ID</span><div className="relative"><input value={sessionId} onChange={(event) => setSessionId(event.target.value)} disabled={isConnected} placeholder="Paste the receiver session ID" className="field pr-11" /><button type="button" aria-label="Copy or paste session ID" onClick={copySessionId} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-mist hover:text-navy"><ClipboardPaste className="h-4 w-4" /></button></div>{copied && <span className="mt-1 block text-xs text-aqua">Session ID copied.</span>}</label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-slate-500">Join code</span><input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} disabled={isConnected} placeholder="e.g. B7K4M2Q9" className="field font-mono uppercase tracking-[.2em]" /></label><button type="submit" disabled={isConnected || isConnecting} className="button-secondary w-full">{isConnecting ? 'Connecting…' : isConnected ? 'Receiver connected' : <>Connect to receiver <ArrowRight className="h-4 w-4" /></>}</button></form>
        {Boolean(connectionError) && <div className="mt-5"><ErrorAlert error={connectionError} onDismiss={() => setConnectionError(null)} /></div>}
        {isConnected && <div className="mt-5 flex items-start gap-3 rounded-2xl bg-aqua/8 p-4 text-sm text-[#087d73]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>Pairing succeeded. Your message can now be submitted through this sender session.</p></div>}
        <button type="button" onClick={reset} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-navy"><RotateCcw className="h-3.5 w-3.5" /> Start over</button>
      </section>
      <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7 ${!isConnected ? 'opacity-70' : ''}`}><div className="flex items-start justify-between"><div><div className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Step 02</div><h2 className="mt-1 text-xl font-bold text-ink">Compose and send</h2></div><FileCheck2 className="h-5 w-5 text-aqua" /></div><form className="mt-7 space-y-5" onSubmit={handleSend}><label className="block"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">Message</span><span className={`text-xs font-semibold ${messageBytes > MAX_MESSAGE_BYTES ? 'text-coral' : 'text-slate-400'}`}>{messageBytes.toLocaleString()} / {MAX_MESSAGE_BYTES.toLocaleString()} bytes</span></div><textarea value={message} onChange={(event) => setMessage(event.target.value)} disabled={!isConnected} rows={6} placeholder="Write the message that should be recovered…" className="field resize-none leading-6" /></label><ImageDropzone value={coverImage} onChange={setCoverImage} /><button type="submit" disabled={!canSend} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-40">{isSending ? 'Submitting workflow…' : <><Send className="h-4 w-4" /> Encrypt and send</>}</button></form>{Boolean(sendError) && <div className="mt-5"><ErrorAlert error={sendError} onDismiss={() => setSendError(null)} /></div>}{Boolean(statusError) && <div className="mt-5"><ErrorAlert error={statusError} title="Status updates paused" /></div>}</section>
    </div>
    {isConnected && !messageId && <LivePreview preview={preview} image={previewImage} isLoading={isPreviewLoading} error={previewError} />}
    {(senderSession && (messageId || status)) && <section className="mt-6 grid gap-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7 lg:grid-cols-[.8fr_1.2fr]"><div><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Live workflow</p><h2 className="mt-1 text-xl font-bold text-ink">Transfer progress</h2></div>{status && <StatusBadge status={status.phase} />}</div><div className="mt-6"><ProgressTimeline phase={status?.phase ?? 'connected'} progress={status?.progress ?? 0} /></div></div><div className="rounded-2xl bg-mist/70 p-5"><div className="flex items-center gap-2 text-sm font-bold text-ink"><LockKeyhole className="h-4 w-4 text-aqua" />Message status</div><p className="mt-3 text-sm leading-6 text-slate-600">The sender can see operational progress, but only the receiver endpoint can retrieve plaintext results.</p>{messageId && <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Message ID</div><div className="mt-1 break-all font-mono text-xs text-ink">{messageId}</div></div>}{status?.bytes_total ? <div className="mt-4 text-xs text-slate-500">{status.bytes_sent?.toLocaleString() ?? 0} / {status.bytes_total.toLocaleString()} bytes reported</div> : null}</div></section>}
  </div>;
}

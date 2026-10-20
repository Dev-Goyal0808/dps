import { BarChart3, CheckCircle2, Image as ImageIcon, Play, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { MetricCard } from '../components/MetricCard';
import { metricIcons } from '../components/metricIcons';
import { StatusBadge } from '../components/StatusBadge';
import { useSessions } from '../context/SessionContext';
import { api } from '../services/api';
import type { EvaluationResponse } from '../types/api';

function value(value: number | undefined, suffix = '') {
  return value === undefined ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

export function AnalysisPage() {
  const { receiverSession } = useSessions();
  const [messageId, setMessageId] = useState(receiverSession?.messageId ?? '');
  const [includeImageComparison, setIncludeImageComparison] = useState(true);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (receiverSession?.messageId && !messageId) setMessageId(receiverSession.messageId);
  }, [messageId, receiverSession?.messageId]);

  const runEvaluation = async (event: FormEvent) => {
    event.preventDefault();
    if (!receiverSession || !messageId.trim()) return;
    setIsLoading(true); setError(null);
    try {
      const result = await api.evaluateMessage(messageId.trim(), receiverSession.token, includeImageComparison);
      setEvaluation(result);
    } catch (nextError) {
      setError(nextError);
    } finally { setIsLoading(false); }
  };

  const metrics = evaluation?.metrics;
  return <div className="mx-auto max-w-7xl animate-fade-up px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
    <div className="mb-9"><p className="text-xs font-bold uppercase tracking-[.18em] text-aqua">Evaluation lab</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Measure the transfer</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Inspect backend-recorded image quality, capacity, processing timings, and recovery state. These are measurements for this message—not guarantees about future images.</p></div>
    <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-white"><BarChart3 className="h-5 w-5" /></div><h2 className="mt-6 text-xl font-bold text-ink">Run an evaluation</h2><p className="mt-2 text-sm leading-6 text-slate-500">Analysis uses the receiver credential kept in this tab. Start a receiver session first if no active credential is available.</p><form onSubmit={runEvaluation} className="mt-6 space-y-5"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-slate-500">Message ID</span><input value={messageId} onChange={(event) => setMessageId(event.target.value)} placeholder="Completed message ID" className="field font-mono text-xs" /></label><label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-mist/70 p-4"><input type="checkbox" checked={includeImageComparison} onChange={(event) => setIncludeImageComparison(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#22c7b8]" /><span><span className="block text-sm font-semibold text-ink">Include image comparison</span><span className="mt-1 block text-xs leading-5 text-slate-500">Request PSNR and SSIM when the backend has the original and received images.</span></span></label><button type="submit" disabled={!receiverSession || !messageId.trim() || isLoading} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-40">{isLoading ? 'Measuring…' : <><Play className="h-4 w-4" /> Run evaluation</>}</button></form>{!receiverSession && <div className="mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-xs leading-5 text-[#806000]">No active receiver credential. <Link to="/receive" className="font-bold underline underline-offset-4">Create a receiving session</Link> to authorize analysis.</div>}{Boolean(error) && <div className="mt-5"><ErrorAlert error={error} /></div>}</section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Measured output</p><h2 className="mt-1 text-xl font-bold text-ink">Message evaluation</h2></div>{evaluation && <StatusBadge status={evaluation.recovery_status} />}</div>{!evaluation ? <div className="flex min-h-72 flex-col items-center justify-center text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-navy"><ImageIcon className="h-6 w-6" /></div><h3 className="mt-5 font-bold text-ink">No evaluation loaded</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Complete a receiving workflow, then run the evaluation to see actual image and network measurements.</p></div> : <div className="mt-6"><div className="grid gap-3 sm:grid-cols-2"><MetricCard label="PSNR" value={value(metrics?.psnr, ' dB')} detail="Peak signal-to-noise ratio" icon={metricIcons.Image} tone="aqua" /><MetricCard label="SSIM" value={value(metrics?.ssim)} detail="Structural similarity" icon={metricIcons.Gauge} tone="navy" /><MetricCard label="Capacity" value={value(metrics?.capacity_bytes, ' B')} detail={`${value(metrics?.payload_bytes, ' B')} payload`} icon={metricIcons.Activity} tone="gold" /><MetricCard label="Utilization" value={value(metrics?.capacity_utilization ? metrics.capacity_utilization * 100 : undefined, '%')} detail={value(metrics?.remaining_bytes, ' B remaining')} icon={metricIcons.Gauge} tone="coral" /></div><div className="mt-6 rounded-2xl bg-mist/70 p-5"><div className="flex items-center gap-2 text-sm font-bold text-ink"><ShieldCheck className="h-4 w-4 text-aqua" /> Processing timings</div><div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 text-sm"><Timing label="Encryption" value={value(metrics?.encryption_time_ms, ' ms')} /><Timing label="Embedding" value={value(metrics?.embedding_time_ms, ' ms')} /><Timing label="Extraction" value={value(metrics?.extraction_time_ms, ' ms')} /><Timing label="Decryption" value={value(metrics?.decryption_time_ms, ' ms')} /><Timing label="Transmission" value={value(metrics?.transmission_time_ms, ' ms')} /><Timing label="Throughput" value={value(metrics?.throughput_bytes_per_second, ' B/s')} /></div></div><div className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-aqua" /> Recovery status is reported by the authenticated backend result. A rejected result never exposes plaintext here.</div></div>}</section>
    </div>
    <div className="mt-8 rounded-3xl border border-gold/30 bg-gold/10 p-5 text-sm leading-6 text-[#725500] sm:p-6"><strong>Interpretation note:</strong> PSNR and SSIM depend on image content, dimensions, QIM delta, payload size, and hardware. StegoCrypt uses lossless PNG; resizing, JPEG recompression, cropping, rotation, or filtering can break recovery.</div>
  </div>;
}

function Timing({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-semibold text-ink">{value}</div></div>;
}

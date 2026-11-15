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

function format(value: number | null | undefined, digits = 2, suffix = '') {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;
}

const GLOSSARY: Array<{ term: string; meaning: string; better: string }> = [
  {
    term: 'PSNR',
    meaning: '10 · log₁₀(255² / MSE) over every red, green, and blue sample of the original and received images.',
    better: 'Higher is better. Infinite is never reported; an unchanged image shows “—”.',
  },
  {
    term: 'SSIM',
    meaning: 'Whole-image structural similarity from luminance means, variances, and covariance (C₁ = 6.5025, C₂ = 58.5225).',
    better: '1.0 means identical structure. A small payload leaves almost every sample untouched, so this stays within a hair of 1 — read it together with the sample metrics, not alone.',
  },
  {
    term: 'MSE / RMSE',
    meaning: 'Mean and root-mean squared error per 8-bit channel sample. RMSE is in the same units as a pixel value.',
    better: 'Lower is better.',
  },
  {
    term: 'Max channel error',
    meaning: 'The largest single-channel change QIM made, out of 255.',
    better: 'Lower is better; it is bounded by how far one quantization level can move a sample.',
  },
  {
    term: 'Changed samples',
    meaning: 'How many of the image’s RGB channels differ between the cover and the stego PNG, and the share of the total.',
    better: 'Lower means a smaller steganographic footprint. This is the metric that stays informative when SSIM saturates.',
  },
  {
    term: 'Mean shift',
    meaning: 'Average absolute change across only the channels that were modified.',
    better: 'Lower is less visible. Reported as a value out of 255.',
  },
  {
    term: 'Embedding rate',
    meaning: 'Container bits (16-byte SCQ1 header plus payload) per image pixel, in bits per pixel (bpp).',
    better: 'Lower is a lighter touch on the carrier. Utilisation shows the same load against total capacity.',
  },
  {
    term: 'Ciphertext entropy',
    meaning: 'Shannon entropy of the serialized SCEP payload in bits per byte, measured on the bytes actually embedded.',
    better: 'Close to 8.0 means byte values are near-uniform, which is what authenticated ciphertext should look like. It is a property of the output, not a security proof.',
  },
  {
    term: 'Plaintext match',
    meaning: 'The receiver re-encrypts nothing: it compares the decrypted bytes against the sender’s original input.',
    better: 'True means the round trip returned exactly what was sent.',
  },
];

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
  const changedShare = metrics?.changed_sample_ratio;
  return <div className="mx-auto max-w-7xl animate-fade-up px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
    <div className="mb-9"><p className="text-xs font-bold uppercase tracking-[.18em] text-aqua">Evaluation lab</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Measure the transfer</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Every value below is computed by the backend from this message: the cover image, the received PNG, the serialized payload, and the phase timers. Nothing is filled in from a table or a reference run.</p></div>
    <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-white"><BarChart3 className="h-5 w-5" /></div><h2 className="mt-6 text-xl font-bold text-ink">Run an evaluation</h2><p className="mt-2 text-sm leading-6 text-slate-500">Analysis uses the receiver credential kept in this tab. Start a receiver session first if no active credential is available.</p><form onSubmit={runEvaluation} className="mt-6 space-y-5"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-slate-500">Message ID</span><input value={messageId} onChange={(event) => setMessageId(event.target.value)} placeholder="Completed message ID" className="field font-mono text-xs" /></label><label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-mist/70 p-4"><input type="checkbox" checked={includeImageComparison} onChange={(event) => setIncludeImageComparison(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#22c7b8]" /><span><span className="block text-sm font-semibold text-ink">Include image comparison</span><span className="mt-1 block text-xs leading-5 text-slate-500">Ask for PSNR, SSIM, error, and sample-level values. Leave it off to receive only capacity, crypto, timing, and recovery measurements.</span></span></label><button type="submit" disabled={!receiverSession || !messageId.trim() || isLoading} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-40">{isLoading ? 'Measuring…' : <><Play className="h-4 w-4" /> Run evaluation</>}</button></form>{!receiverSession && <div className="mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-xs leading-5 text-[#806000]">No active receiver credential. <Link to="/receive" className="font-bold underline underline-offset-4">Create a receiving session</Link> to authorize analysis.</div>}{Boolean(error) && <div className="mt-5"><ErrorAlert error={error} /></div>}</section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Measured output</p><h2 className="mt-1 text-xl font-bold text-ink">Message evaluation</h2></div>{evaluation && <StatusBadge status={evaluation.recovery_status} />}</div>{!evaluation ? <div className="flex min-h-72 flex-col items-center justify-center text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-navy"><ImageIcon className="h-6 w-6" /></div><h3 className="mt-5 font-bold text-ink">No evaluation loaded</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Complete a receiving workflow, then run the evaluation to see measurements taken from that exact message.</p></div> : <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">Image and payload</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MetricCard label="PSNR" value={format(metrics?.psnr, 2, ' dB')} detail="Global RGB signal-to-noise · higher is better" icon={metricIcons.Image} tone="aqua" />
          <MetricCard label="SSIM" value={format(metrics?.ssim, 6)} detail="Whole-image structural similarity · saturates near 1" icon={metricIcons.Gauge} tone="navy" />
          <MetricCard label="MSE" value={format(metrics?.mse, 4)} detail={`RMSE ${format(metrics?.rmse, 3)} per channel · lower is better`} icon={metricIcons.Activity} tone="gold" />
          <MetricCard label="Max channel error" value={format(metrics?.max_abs_error, 0, ' / 255')} detail="Largest single-channel change" icon={metricIcons.Gauge} tone="coral" />
          <MetricCard label="Changed samples" value={format(changedShare === null || changedShare === undefined ? undefined : changedShare * 100, 4, '%')} detail={`${format(metrics?.changed_samples, 0)} of ${format(metrics?.total_samples, 0)} RGB channels`} icon={metricIcons.Activity} tone="aqua" />
          <MetricCard label="Mean shift" value={format(metrics?.mean_abs_error_changed, 2, ' / 255')} detail="Average change across modified channels" icon={metricIcons.Gauge} tone="navy" />
          <MetricCard label="Embedding rate" value={format(metrics?.embedding_rate_bpp, 4, ' bpp')} detail="Container bits per pixel" icon={metricIcons.Timer} tone="gold" />
          <MetricCard label="Ciphertext entropy" value={format(metrics?.ciphertext_entropy_bits_per_byte, 4, ' bits/B')} detail={`Measured · ceiling log₂(${format(metrics?.payload_bytes, 0)} B) = ${format(metrics?.ciphertext_entropy_ceiling_bits_per_byte, 2)} bits/B`} icon={metricIcons.Activity} tone="coral" />
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-slate-400">Capacity and envelope</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MetricCard label="Capacity" value={format(metrics?.capacity_bytes, 0, ' B')} detail={`${format(metrics?.payload_bytes, 0, ' B')} payload · ${format(metrics?.remaining_bytes, 0, ' B')} free`} icon={metricIcons.Activity} tone="gold" />
          <MetricCard label="Utilisation" value={format(metrics?.capacity_utilization === undefined || metrics?.capacity_utilization === null ? undefined : metrics.capacity_utilization * 100, 4, '%')} detail={`${format(metrics?.plaintext_bytes, 0, ' B')} plaintext + ${format(metrics?.payload_overhead_bytes, 0, ' B')} envelope`} icon={metricIcons.Gauge} tone="coral" />
        </div>

        <div className="mt-6 rounded-2xl bg-mist/70 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><ShieldCheck className="h-4 w-4 text-aqua" /> Processing timings</div>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
            <Timing label="TCP connect" value={format(metrics?.connection_time_ms, 2, ' ms')} />
            <Timing label="Key exchange" value={format(metrics?.key_exchange_time_ms, 2, ' ms')} />
            <Timing label="Encryption" value={format(metrics?.encryption_time_ms, 2, ' ms')} />
            <Timing label="Embedding" value={format(metrics?.embedding_time_ms, 2, ' ms')} />
            <Timing label="PNG transfer" value={format(metrics?.transmission_time_ms, 2, ' ms')} />
            <Timing label="Extraction" value={format(metrics?.extraction_time_ms, 2, ' ms')} />
            <Timing label="Decryption" value={format(metrics?.decryption_time_ms, 2, ' ms')} />
            <Timing label="Receiver workflow" value={format(metrics?.workflow_time_ms, 2, ' ms')} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Timing label="Image throughput" value={format(metrics?.throughput_bytes_per_second, 0, ' B/s')} />
            <Timing label="Payload throughput" value={format(metrics?.payload_throughput_bytes_per_second, 0, ' B/s')} />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Image throughput is the PNG size divided by transfer time. Payload throughput is the embedded payload divided by the receiver workflow (transfer + extraction + decryption). Receiver workflow time is measured on the receiving side only.</p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><CheckCircle2 className="h-4 w-4 text-aqua" /> Round-trip verification</div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-baseline justify-between gap-3"><span className="text-xs text-slate-500">Recovery status</span><span className="font-mono text-xs font-bold text-ink">{evaluation.recovery_status}</span></div>
            <div className="flex items-baseline justify-between gap-3"><span className="text-xs text-slate-500">Plaintext match</span><span className="font-mono text-xs font-bold text-ink">{metrics?.plaintext_match === true ? 'true' : metrics?.plaintext_match === false ? 'false' : '—'}</span></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">These come from the authenticated backend result. A rejected message reports <span className="font-mono">rejected</span> and never exposes plaintext here.</p>
        </div>
      </div>}</section>
    </div>

    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
      <h2 className="text-lg font-bold text-ink">What each value represents</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Definitions match the backend calculation. Image values compare the in-memory cover image with the received PNG; capacity and entropy use the embedded container.</p>
      <dl className="mt-5 divide-y divide-slate-100">
        {GLOSSARY.map((entry) => <div key={entry.term} className="grid gap-2 py-3 sm:grid-cols-[.28fr_.72fr]">
          <dt className="text-sm font-bold text-ink">{entry.term}</dt>
          <dd className="text-sm leading-6 text-slate-600">{entry.meaning} <span className="block text-xs leading-5 text-slate-500">{entry.better}</span></dd>
        </div>)}
      </dl>
    </section>

    <div className="mt-8 rounded-3xl border border-gold/30 bg-gold/10 p-5 text-sm leading-6 text-[#725500] sm:p-6"><strong>Interpretation note:</strong> these are measurements for one message on this machine. PSNR and SSIM depend on image content, dimensions, QIM delta, and payload size; timings depend on hardware and load. StegoCrypt uses lossless PNG, so resizing, JPEG recompression, cropping, rotation, or filtering can break recovery.</div>
  </div>;
}

function Timing({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-semibold text-ink">{value}</div></div>;
}

import type { LucideIcon } from 'lucide-react';
import { Activity } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: 'aqua' | 'gold' | 'navy' | 'coral';
}

const tones = {
  aqua: 'bg-aqua/10 text-[#087d73]',
  gold: 'bg-gold/20 text-[#8c6500]',
  navy: 'bg-navy/10 text-navy',
  coral: 'bg-coral/15 text-[#b34e3e]',
};

export function MetricCard({ label, value, detail, icon: Icon = Activity, tone = 'aqua' }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" aria-hidden="true" /></span></div>
      <div className="mt-4 text-2xl font-bold tracking-tight text-ink">{value}</div>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

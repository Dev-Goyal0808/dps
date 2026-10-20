import { Check, CircleAlert, LoaderCircle, LockKeyhole, Radio, X } from 'lucide-react';
import type { SessionPhase } from '../types/api';

interface StatusBadgeProps {
  status: SessionPhase | string;
  label?: string;
  compact?: boolean;
}

const statusStyles: Record<string, { className: string; icon: typeof Check }> = {
  completed: { className: 'bg-aqua/12 text-[#087d73]', icon: Check },
  verified: { className: 'bg-aqua/12 text-[#087d73]', icon: LockKeyhole },
  rejected: { className: 'bg-coral/15 text-[#b34e3e]', icon: X },
  failed: { className: 'bg-coral/15 text-[#b34e3e]', icon: CircleAlert },
  expired: { className: 'bg-slate-200 text-slate-600', icon: CircleAlert },
  transferring: { className: 'bg-blue-100 text-blue-700', icon: Radio },
  verifying: { className: 'bg-gold/25 text-[#8c6500]', icon: LoaderCircle },
};

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StatusBadge({ status, label, compact = false }: StatusBadgeProps) {
  const config = statusStyles[status] ?? { className: 'bg-slate-100 text-slate-600', icon: Radio };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} ${config.className}`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'verifying' ? 'animate-spin' : ''}`} aria-hidden="true" />
      {label ?? titleCase(status)}
    </span>
  );
}

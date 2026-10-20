import { Check, Circle, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import type { SessionPhase } from '../types/api';

const phases: Array<{ id: SessionPhase; label: string; detail: string }> = [
  { id: 'waiting', label: 'Pairing', detail: 'Waiting for a trusted endpoint' },
  { id: 'connected', label: 'Connected', detail: 'Session is ready for a message' },
  { id: 'encrypting', label: 'Encrypting', detail: 'Authenticated message protection' },
  { id: 'embedding', label: 'Embedding', detail: 'Writing the payload into PNG pixels' },
  { id: 'transferring', label: 'Transferring', detail: 'Moving the lossless image' },
  { id: 'extracting', label: 'Extracting', detail: 'Reading the embedded payload' },
  { id: 'verifying', label: 'Verifying', detail: 'Checking integrity and authentication' },
  { id: 'completed', label: 'Complete', detail: 'Verified recovery is available' },
];

const phaseOrder = phases.map((phase) => phase.id);
const aliases: Partial<Record<SessionPhase, SessionPhase>> = {
  pairing: 'waiting',
  validating: 'connected',
};

interface ProgressTimelineProps {
  phase?: SessionPhase;
  progress?: number;
}

export function ProgressTimeline({ phase = 'waiting', progress = 0 }: ProgressTimelineProps) {
  const normalized = aliases[phase] ?? phase;
  const currentIndex = phaseOrder.indexOf(normalized);
  const isFailure = phase === 'failed' || phase === 'rejected' || phase === 'expired';

  return (
    <div className="space-y-4" aria-label="Message workflow progress">
      {phases.map((item, index) => {
        const isComplete = !isFailure && currentIndex > index;
        const isCurrent = !isFailure && currentIndex === index;
        const isLast = index === phases.length - 1;
        return (
          <div className="relative flex gap-3" key={item.id}>
            {!isLast && <span className={`absolute left-[13px] top-7 h-[calc(100%+4px)] w-px ${isComplete ? 'bg-aqua' : 'bg-slate-200'}`} />}
            <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${isFailure && isCurrent ? 'border-coral bg-coral text-white' : isComplete ? 'border-aqua bg-aqua text-white' : isCurrent ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white text-slate-400'}`}>
              {isFailure && isCurrent ? <X className="h-3.5 w-3.5" /> : isComplete ? <Check className="h-3.5 w-3.5" /> : isCurrent && phase === 'verifying' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : isCurrent && phase === 'completed' ? <ShieldCheck className="h-3.5 w-3.5" /> : isCurrent ? <Circle className="h-3 w-3 fill-current" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <div className="-mt-0.5 min-w-0">
              <div className={`text-sm font-semibold ${isCurrent || isComplete ? 'text-ink' : 'text-slate-400'}`}>{item.label}</div>
              <p className={`mt-0.5 text-xs ${isCurrent ? 'text-slate-600' : 'text-slate-400'}`}>{isFailure && isCurrent ? `Workflow ${phase}.` : item.detail}</p>
              {isCurrent && phase === 'transferring' && <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-aqua transition-[width] duration-500" style={{ width: `${Math.max(3, Math.min(100, progress * 100))}%` }} /></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

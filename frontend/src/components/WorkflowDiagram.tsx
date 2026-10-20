import { ArrowRight, CheckCheck, FileKey2, LockKeyhole, ScanSearch, ShieldCheck } from 'lucide-react';

const steps = [
  { icon: FileKey2, label: 'Compose', detail: 'One message' },
  { icon: LockKeyhole, label: 'Encrypt', detail: 'AES-GCM payload' },
  { icon: ScanSearch, label: 'Inspect', detail: 'Encoded material' },
  { icon: CheckCheck, label: 'Recover', detail: 'Exact plaintext' },
  { icon: ShieldCheck, label: 'Verify', detail: 'Authenticated result' },
];

export function WorkflowDiagram() {
  return (
    <div className="grid gap-3 sm:grid-cols-5 sm:gap-0">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return <div className="relative flex items-center gap-3 sm:block sm:px-3 sm:text-center" key={step.label}>
          <div className="relative z-10 mx-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-navy shadow-sm sm:mx-auto"><Icon className="h-5 w-5" /></div>
          <div className="mt-0 sm:mt-3"><div className="text-sm font-bold text-ink">{step.label}</div><div className="mt-0.5 text-xs text-slate-500">{step.detail}</div></div>
          {index < steps.length - 1 && <ArrowRight className="absolute right-[-10px] top-4 hidden h-5 w-5 text-aqua sm:block" aria-hidden="true" />}
        </div>;
      })}
    </div>
  );
}

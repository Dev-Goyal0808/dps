import { ArrowRight, CheckCheck, Image as ImageIcon, KeyRound, LockKeyhole, Network, ScanSearch } from 'lucide-react';

const steps = [
  { icon: KeyRound, label: 'Pair', detail: 'Signed X25519 handshake' },
  { icon: LockKeyhole, label: 'Encrypt', detail: 'AES-256-GCM payload' },
  { icon: ImageIcon, label: 'Embed', detail: 'One bit per RGB channel' },
  { icon: Network, label: 'Transfer', detail: 'Length-framed TCP chunks' },
  { icon: ScanSearch, label: 'Extract', detail: 'Header, CRC, then decrypt' },
  { icon: CheckCheck, label: 'Verify', detail: 'Plaintext only on success' },
];

export function WorkflowDiagram() {
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-0">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return <div className="relative flex items-center gap-3 sm:block sm:px-2 sm:text-left" key={step.label}>
          <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-navy shadow-sm"><Icon className="h-5 w-5" aria-hidden="true" /></div>
          <div className="min-w-0 sm:mt-3"><div className="text-sm font-bold text-ink">{index + 1}. {step.label}</div><div className="mt-0.5 text-xs leading-5 text-slate-500">{step.detail}</div></div>
          {index < steps.length - 1 && <ArrowRight className="absolute right-[-12px] top-3 hidden h-5 w-5 text-aqua lg:block" aria-hidden="true" />}
        </div>;
      })}
    </div>
  );
}

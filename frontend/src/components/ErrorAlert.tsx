import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import type { ApiErrorPayload } from '../types/api';

interface ErrorAlertProps {
  error?: ApiErrorPayload | Error | unknown | null;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

function errorParts(error: ErrorAlertProps['error']) {
  if (!error) return { message: '', code: undefined };
  if (error instanceof Error) return { message: error.message, code: undefined };
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return { message: error.message, code: 'code' in error && typeof error.code === 'string' ? error.code : undefined };
  }
  return { message: 'Something went wrong. Please try again.', code: undefined };
}

export function ErrorAlert({ error, title = 'We could not complete that step', onRetry, onDismiss }: ErrorAlertProps) {
  const { message, code } = errorParts(error);
  if (!message) return null;
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-coral/30 bg-coral/10 p-4 text-[#8f3e32]">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="font-semibold">{title}</div>{onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="rounded-lg p-1 hover:bg-coral/10"><X className="h-4 w-4" /></button>}</div><p className="mt-1 text-sm leading-6">{message}</p>{code && <p className="mt-2 font-mono text-[11px] uppercase tracking-wide opacity-75">{code}</p>}{onRetry && <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-4"><RefreshCw className="h-3.5 w-3.5" /> Try again</button>}</div>
    </div>
  );
}

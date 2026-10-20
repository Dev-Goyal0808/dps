import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { SessionStatusResponse } from '../types/api';

const TERMINAL_PHASES = new Set(['completed', 'rejected', 'failed', 'expired']);

interface UseSessionStatusOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export function useSessionStatus(
  sessionId: string | undefined,
  token: string | undefined,
  { enabled = true, intervalMs = 1500 }: UseSessionStatusOptions = {},
) {
  const [status, setStatus] = useState<SessionStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!sessionId || !token) return null;
    setIsLoading(true);
    try {
      const nextStatus = await api.getSessionStatus(sessionId, token);
      setStatus(nextStatus);
      setError(null);
      return nextStatus;
    } catch (nextError) {
      setError(nextError);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, token]);

  useEffect(() => {
    if (!enabled || !sessionId || !token) {
      setStatus(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      if (cancelled) return;
      const nextStatus = await refresh();
      if (!cancelled && (!nextStatus || !TERMINAL_PHASES.has(nextStatus.phase))) {
        timer = window.setTimeout(() => void poll(), intervalMs);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [enabled, intervalMs, refresh, sessionId, token]);

  return {
    status,
    isLoading,
    error,
    refresh,
    isTerminal: Boolean(status && TERMINAL_PHASES.has(status.phase)),
  };
}

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { SessionRole } from '../types/api';

export interface ActiveSession {
  sessionId: string;
  token: string;
  role: SessionRole;
  messageId?: string;
  joinCode?: string;
  expiresAt?: string;
  fingerprint?: string;
}

interface SessionContextValue {
  receiverSession?: ActiveSession;
  senderSession?: ActiveSession;
  setReceiverSession: (session: ActiveSession | undefined) => void;
  setSenderSession: (session: ActiveSession | undefined) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [receiverSession, setReceiverSession] = useState<ActiveSession>();
  const [senderSession, setSenderSession] = useState<ActiveSession>();
  const value = useMemo(() => ({ receiverSession, senderSession, setReceiverSession, setSenderSession }), [receiverSession, senderSession]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessions() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSessions must be used inside SessionProvider');
  return context;
}

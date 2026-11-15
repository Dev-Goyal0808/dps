import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { SessionProvider } from './context/SessionContext';
import { AboutPage } from './pages/AboutPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { EncryptionLabPage } from './pages/EncryptionLabPage';
import { HomePage } from './pages/HomePage';
import { ReceiveMessagePage } from './pages/ReceiveMessagePage';
import { SendMessagePage } from './pages/SendMessagePage';

export function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SessionProvider><Routes><Route element={<AppShell />}><Route path="/" element={<HomePage />} /><Route path="/receive" element={<ReceiveMessagePage />} /><Route path="/send" element={<SendMessagePage />} /><Route path="/analysis" element={<AnalysisPage />} /><Route path="/encryption" element={<EncryptionLabPage />} /><Route path="/about" element={<AboutPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></SessionProvider></BrowserRouter>;
}

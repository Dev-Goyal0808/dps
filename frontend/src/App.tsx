import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { SessionProvider } from './context/SessionContext';
import { AboutPage } from './pages/AboutPage';
import { EncryptionLabPage } from './pages/EncryptionLabPage';
import { HomePage } from './pages/HomePage';

export function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SessionProvider><Routes><Route element={<AppShell />}><Route path="/" element={<HomePage />} /><Route path="/encryption" element={<EncryptionLabPage />} /><Route path="/about" element={<AboutPage />} /><Route path="/send" element={<Navigate to="/encryption" replace />} /><Route path="/receive" element={<Navigate to="/encryption" replace />} /><Route path="/analysis" element={<Navigate to="/encryption" replace />} /><Route path="/stego/*" element={<Navigate to="/encryption" replace />} /><Route path="/steganography/*" element={<Navigate to="/encryption" replace />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></SessionProvider></BrowserRouter>;
}

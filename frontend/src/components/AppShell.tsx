import { BarChart3, ChevronDown, FlaskConical, Home, Inbox, Info, Menu, Send, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSessions } from '../context/SessionContext';

const links = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/receive', label: 'Receive', icon: Inbox },
  { to: '/send', label: 'Send', icon: Send },
  { to: '/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/encryption', label: 'Encryption Lab', icon: FlaskConical },
  { to: '/about', label: 'How it works', icon: Info },
];

const footerLinks = [
  { to: '/receive', label: 'Receive a message' },
  { to: '/send', label: 'Send a message' },
  { to: '/analysis', label: 'Measure a transfer' },
  { to: '/encryption', label: 'Encryption Lab' },
  { to: '/about', label: 'Protocol and limits' },
];

export function AppShell() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { receiverSession, senderSession } = useSessions();
  return <div className="flex min-h-screen flex-col bg-[#f7fafc] text-ink">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <NavLink to="/" className="group flex shrink-0 items-center gap-3" onClick={() => setIsMenuOpen(false)}>
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white shadow-lg shadow-navy/15"><span className="absolute h-4 w-4 rounded-full border-2 border-aqua" /><span className="h-1.5 w-1.5 rounded-full bg-aqua" /></span>
          <span><span className="block text-sm font-extrabold tracking-tight text-ink">StegoCrypt</span><span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:block">Messages in pixels</span></span>
        </NavLink>
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary navigation">
          {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `group inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors ${isActive ? 'bg-navy text-white shadow-md shadow-navy/10' : 'text-slate-500 hover:bg-mist hover:text-ink'}`}><Icon className="h-4 w-4" />{label}</NavLink>)}
        </nav>
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {receiverSession && <NavLink to="/receive" className="inline-flex items-center gap-1.5 rounded-full border border-aqua/30 bg-aqua/10 px-3 py-1.5 text-[11px] font-bold text-[#087d73] hover:bg-aqua/20"><span className="h-1.5 w-1.5 rounded-full bg-aqua" />Receiving</NavLink>}
          {senderSession && <NavLink to="/send" className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-mist px-3 py-1.5 text-[11px] font-bold text-navy hover:bg-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-navy" />Sending</NavLink>}
          {!receiverSession && !senderSession && <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-aqua" />Session in memory</span>}
        </div>
        <button type="button" className="rounded-xl p-2 text-slate-600 hover:bg-mist lg:hidden" aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((open) => !open)}>{isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {isMenuOpen && <nav className="border-t border-slate-200 bg-white px-5 py-3 lg:hidden" aria-label="Mobile navigation">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setIsMenuOpen(false)} className={({ isActive }) => `mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${isActive ? 'bg-navy text-white' : 'text-slate-600 hover:bg-mist'}`}><Icon className="h-4 w-4" />{label}<ChevronDown className="ml-auto h-4 w-4 -rotate-90 opacity-40" /></NavLink>)}</nav>}
    </header>
    <main className="flex-1"><Outlet /></main>
    <footer className="border-t border-slate-200/80 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:px-10">
        <div>
          <div className="flex items-center gap-2.5"><span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-navy text-white"><span className="absolute h-3 w-3 rounded-full border-2 border-aqua" /><span className="h-1 w-1 rounded-full bg-aqua" /></span><span className="text-sm font-extrabold text-ink">StegoCrypt</span></div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">An educational prototype for authenticated encryption, QIM image steganography, and framed TCP transfer. Sessions and results live in memory and expire automatically.</p>
          <p className="mt-3 text-xs text-slate-400">Not a production messaging system. PNG transfers only.</p>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Go to</div>
          <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">{footerLinks.map((link) => <li key={link.to}><NavLink to={link.to} className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-navy hover:underline">{link.label}</NavLink></li>)}</ul>
        </div>
      </div>
    </footer>
  </div>;
}

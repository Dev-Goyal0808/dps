import { ChevronDown, CircleHelp, FlaskConical, Home, Info, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/encryption', label: 'Encryption Lab', icon: FlaskConical },
  { to: '/about', label: 'About', icon: Info },
];

export function AppShell() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return <div className="min-h-screen bg-[#f7fafc] text-ink">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <NavLink to="/" className="group flex items-center gap-3" onClick={() => setIsMenuOpen(false)}>
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white shadow-lg shadow-navy/15"><span className="absolute h-4 w-4 rounded-full border-2 border-aqua" /><span className="h-1.5 w-1.5 rounded-full bg-aqua" /></span>
          <span><span className="block text-sm font-extrabold tracking-tight text-ink">StegoCrypt</span><span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:block">Private by design</span></span>
        </NavLink>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-navy text-white shadow-md shadow-navy/10' : 'text-slate-500 hover:bg-mist hover:text-ink'}`}><Icon className="h-4 w-4" />{label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex"><span className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-aqua" />Local session</span><NavLink to="/about" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:border-navy hover:text-navy" aria-label="Help and about"><CircleHelp className="h-4 w-4" /></NavLink></div>
        <button type="button" className="rounded-xl p-2 text-slate-600 hover:bg-mist lg:hidden" aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setIsMenuOpen((open) => !open)}>{isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {isMenuOpen && <nav className="border-t border-slate-200 bg-white px-5 py-3 lg:hidden" aria-label="Mobile navigation">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setIsMenuOpen(false)} className={({ isActive }) => `mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${isActive ? 'bg-navy text-white' : 'text-slate-600 hover:bg-mist'}`}><Icon className="h-4 w-4" />{label}<ChevronDown className="ml-auto h-4 w-4 -rotate-90 opacity-40" /></NavLink>)}</nav>}
    </header>
    <main><Outlet /></main>
     <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><span>StegoCrypt · an educational encryption prototype</span><span>Encryption only · no durable message history</span></footer>
  </div>;
}

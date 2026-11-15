import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FlaskConical,
  Gauge,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LockKeyhole,
  Network,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { WorkflowDiagram } from '../components/WorkflowDiagram';

const layers = [
  {
    icon: KeyRound,
    title: 'Trusted endpoints',
    detail: 'Each endpoint signs a fresh X25519 key with its Ed25519 identity. The sender verifies the receiver before a single byte of the message is encrypted, and both fingerprints stay visible in the interface.',
  },
  {
    icon: LockKeyhole,
    title: 'Authenticated encryption',
    detail: 'HKDF-SHA256 turns the shared secret into a per-session AES-256-GCM key. The message ID, session ID, and protocol version travel as associated data, so tampering fails the tag check instead of producing garbage plaintext.',
  },
  {
    icon: ImageIcon,
    title: 'QIM steganography',
    detail: 'Quantization Index Modulation writes one bit into each usable red, green, and blue channel of a cover image. A fixed header carries the payload length and a CRC32 sanity check; the output is always a lossless PNG.',
  },
  {
    icon: Network,
    title: 'Framed transfer',
    detail: 'The PNG moves over a Python TCP socket in 64 KiB chunks. Every frame has a length prefix, the receiver reassembles in order, and the final SHA-256 digest must match before extraction begins.',
  },
];

const destinations = [
  { to: '/receive', icon: Inbox, label: 'Receive a message', detail: 'Open a temporary room, share its join code, and read a message only after the authentication tag passes.' },
  { to: '/send', icon: Send, label: 'Send a message', detail: 'Pair with a room, write the message, pick a cover image, and watch the workflow move from encryption to transfer.' },
  { to: '/analysis', icon: BarChart3, label: 'Measure a transfer', detail: 'Inspect measured PSNR, SSIM, capacity utilization, phase timings, and throughput for a completed message.' },
  { to: '/encryption', icon: FlaskConical, label: 'Encryption Lab', detail: 'Run the cryptographic exchange on its own, with the ciphertext, nonce, fingerprints, and transcript hash exposed.' },
  { to: '/about', icon: ShieldCheck, label: 'How it works', detail: 'Read the layer boundaries, trust model, error codes, and the honest limits of this prototype.' },
];

export function HomePage() {
  return <div>
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="pointer-events-none absolute inset-0 bg-hero-grid bg-[size:32px_32px] opacity-30" />
      <div className="pointer-events-none absolute -right-32 top-0 h-[28rem] w-[28rem] rounded-full bg-aqua/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-coral/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-16 lg:px-10 lg:pb-20">
        <div className="animate-fade-up">
          <h1 className="max-w-2xl font-display text-4xl leading-[1.08] tracking-[-0.02em] sm:text-5xl lg:text-6xl">A message inside a picture. <span className="text-aqua">Proof at the other end.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">StegoCrypt encrypts text with AES-256-GCM, hides the ciphertext in the pixels of an ordinary PNG, and carries the image across a TCP socket. The receiver reads it back only after the signature, payload, and authentication tag all agree.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/receive" className="inline-flex items-center justify-center gap-2 rounded-xl bg-aqua px-5 py-3 text-sm font-bold text-ink shadow-lg shadow-aqua/20 transition-transform hover:-translate-y-0.5"><Inbox className="h-4 w-4" />Start with a receiving room</Link>
            <Link to="/send" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"><Send className="h-4 w-4" />Send to a room</Link>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">No accounts. Sessions and results stay in memory and expire after 30 minutes. Easiest with two browser tabs, one for each role.</p>
        </div>
        <CarrierPanel />
      </div>
      <div className="relative border-t border-white/10">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-5 px-5 py-7 sm:px-8 lg:grid-cols-4 lg:px-10">
          <Fact label="Identity" value="Ed25519 signatures" />
          <Fact label="Key exchange" value="X25519 with HKDF-SHA256" />
          <Fact label="Message" value="AES-256-GCM, 256 KiB limit" />
          <Fact label="Carrier" value="QIM, one bit per channel" />
        </dl>
      </div>
    </section>

    <section id="start" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
      <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">Two roles, one short session</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">The receiver always starts. Rooms are one-shot, so start a fresh session for each message.</p>
        </div>
        <Link to="/about" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-aqua decoration-2 underline-offset-4 hover:text-aqua">See the full protocol<ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-aqua/10 text-[#087d73]"><Inbox className="h-5 w-5" /></span>
            <div><div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Receiver</div><h3 className="text-lg font-bold text-ink">Open a room and wait</h3></div>
          </div>
          <ol className="mt-6 space-y-4">
            <Step index="1" text="Create a receiving session. The backend returns a session ID, an 8-character join code, and the receiver fingerprint." />
            <Step index="2" text="Hand the session ID and join code to the sender through any channel you like." />
            <Step index="3" text="Follow the phase timeline. The recovered text appears only when the result is verified." />
          </ol>
          <Link to="/receive" className="mt-auto inline-flex items-center gap-1.5 pt-7 text-sm font-bold text-navy hover:text-aqua">Create a receiving room<ArrowRight className="h-4 w-4" /></Link>
        </article>
        <article className="flex flex-col rounded-3xl border border-navy/10 bg-navy p-6 text-white shadow-panel sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-aqua"><Send className="h-5 w-5" /></span>
            <div><div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Sender</div><h3 className="text-lg font-bold">Pair, compose, transfer</h3></div>
          </div>
          <ol className="mt-6 space-y-4">
            <Step index="1" text="Enter the room's session ID and join code. The join code is consumed on first use." dark />
            <Step index="2" text="Write the message and choose a cover image large enough to hold the encrypted payload." dark />
            <Step index="3" text="Submit. Encryption, embedding, and the TCP transfer run on the backend; the sender never receives plaintext." dark />
          </ol>
          <Link to="/send" className="mt-auto inline-flex items-center gap-1.5 pt-7 text-sm font-bold text-aqua hover:text-white">Pair with a room<ArrowRight className="h-4 w-4" /></Link>
        </article>
      </div>
    </section>

    <section id="pipeline" className="scroll-mt-20 border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">What happens between the two tabs</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">The browser never touches a key or a pixel. It asks the FastAPI backend to run each phase, then polls a status endpoint that reports progress without exposing secrets. The final plaintext is stored once, for the receiver, and only after decryption succeeds.</p>
            <Link to="/about" className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-navy underline decoration-aqua decoration-2 underline-offset-4 hover:text-aqua">Read the layer boundaries<ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5 sm:p-8"><WorkflowDiagram /></div>
        </div>
      </div>
    </section>

    <section id="layers" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
      <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">Four layers you can inspect</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Each layer has its own tests and a clear boundary. Nothing in the interface performs cryptography or image processing on its own.</p>
      <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {layers.map(({ icon: Icon, title, detail }) => <div key={title} className="border-t border-slate-200 pt-5"><div className="flex items-center gap-2.5"><Icon className="h-5 w-5 text-aqua" aria-hidden="true" /><h3 className="text-base font-bold text-ink">{title}</h3></div><p className="mt-3 text-sm leading-7 text-slate-600">{detail}</p></div>)}
      </div>
    </section>

    <section id="explore" className="scroll-mt-20 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">Where to go next</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">Every part of the project has a page, and each page links back to the flow. Start anywhere.</p>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-xs leading-5 text-[#725500]"><Gauge className="mt-0.5 h-4 w-4 shrink-0" /><p>Measurements on the Analysis page are recorded by the backend for one message. They are evidence for that run, not a guarantee for other images.</p></div>
          </div>
          <nav aria-label="Explore the project" className="overflow-hidden rounded-3xl border border-slate-200">
            {destinations.map(({ to, icon: Icon, label, detail }, index) => <Link key={to} to={to} className={`flex items-start gap-4 px-5 py-5 transition-colors hover:bg-mist/70 sm:px-6 ${index > 0 ? 'border-t border-slate-200' : ''}`}>
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mist text-navy"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block text-sm font-bold text-ink">{label}</span><span className="mt-1 block text-sm leading-6 text-slate-500">{detail}</span></span>
              <ArrowRight className="ml-auto mt-2 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
            </Link>)}
          </nav>
        </div>
      </div>
    </section>

    <section id="limits" className="mx-auto max-w-7xl scroll-mt-20 px-5 pb-16 sm:px-8 lg:px-10 lg:pb-20">
      <div className="grid gap-6 rounded-3xl bg-navy p-7 text-white shadow-panel sm:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
        <div>
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Built for a demonstration, not for production</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">The payload survives a lossless PNG. Resizing, cropping, JPEG recompression, or screenshotting will destroy it. Sessions and keys are in memory, there are no accounts, and an observer can still see timing and transfer size. Read the limits before trusting it with anything real.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
          <Link to="/receive" className="inline-flex items-center justify-center gap-2 rounded-xl bg-aqua px-5 py-3 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5"><Inbox className="h-4 w-4" />Start receiving</Link>
          <Link to="/about" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"><AlertTriangle className="h-4 w-4" />Read the limitations</Link>
        </div>
      </div>
    </section>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-white">{value}</dd></div>;
}

function Step({ index, text, dark = false }: { index: string; text: string; dark?: boolean }) {
  return <li className="flex gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dark ? 'bg-white/10 text-aqua' : 'bg-mist text-navy'}`}>{index}</span><p className={`text-sm leading-6 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{text}</p></li>;
}

function CarrierPanel() {
  return <div className="relative mx-auto w-full max-w-md animate-fade-up rounded-[1.75rem] border border-white/15 bg-[#081a2e]/80 p-5 shadow-2xl backdrop-blur-sm sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><ImageIcon className="h-4 w-4 text-aqua" />Carrier image</div>
      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-slate-400">800 × 600 · PNG</span>
    </div>
    <div className="relative mt-4 h-52 overflow-hidden rounded-xl">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 72% 18%, rgba(255, 200, 120, 0.55), transparent 42%), linear-gradient(180deg, #0d2a44 0%, #17546a 38%, #3b8f83 58%, #164155 74%, #0a1f33 100%)' }} />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.10) 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
      <div className="absolute inset-x-0 top-[58%] flex items-center gap-2">
        <span className="h-px flex-1 bg-aqua/80" />
        <span className="rounded-full border border-aqua/40 bg-[#081a2e]/80 px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.12em] text-aqua">PAYLOAD BAND</span>
        <span className="h-px flex-1 bg-aqua/80" />
      </div>
      <div className="absolute bottom-2 left-2 rounded-md bg-[#081a2e]/75 px-2 py-1 font-mono text-[9px] text-slate-300">Reduced contrast · one bit per channel</div>
    </div>
    <div className="mt-4">
      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400"><span>Embedded bitstream</span><span>header + ciphertext + tag</span></div>
      <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-[#061526] px-3 py-2 font-mono text-[11px] leading-5 tracking-[0.14em]">
        <span className="text-aqua">SCQ1</span><span className="text-slate-500"> 00000011 00101110 11010010 01101001 10110100 01001011</span><span className="text-coral"> 1101</span>
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2 text-[11px] leading-5 text-slate-400"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-aqua" />Extraction re-checks the header, CRC32, and GCM tag before any text is shown.</div>
    <p className="mt-3 text-[10px] text-slate-500">Illustration of the embedding format, not a measured run.</p>
  </div>;
}

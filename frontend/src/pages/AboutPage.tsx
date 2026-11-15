import { AlertTriangle, ArrowRight, Check, Fingerprint, Image as ImageIcon, Layers, LockKeyhole, Network, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
  { id: 'pipeline', label: 'The pipeline' },
  { id: 'cryptography', label: 'Cryptography' },
  { id: 'steganography', label: 'Steganography' },
  { id: 'networking', label: 'Networking' },
  { id: 'boundaries', label: 'What the browser never sees' },
  { id: 'limitations', label: 'Limitations' },
];

const pipeline = [
  { title: 'Pair the endpoints', detail: 'The receiver creates a room with a one-shot join code. The sender exchanges that code for a role-specific bearer token. The session moves from waiting to connected.' },
  { title: 'Authenticate a fresh key', detail: 'Each side generates an X25519 ephemeral key pair and signs its role, the session ID, the identity public key, the ephemeral key, the protocol version, and a nonce with its long-term Ed25519 key. Both sides verify the other signature against a trusted key before continuing.' },
  { title: 'Derive and encrypt', detail: 'The X25519 shared secret is not used directly. HKDF-SHA256 expands it with the handshake transcript as salt into a 32-byte AES key. AES-256-GCM then encrypts the UTF-8 message with a fresh 12-byte nonce, binding the version, session ID, message ID, and algorithm as associated data.' },
  { title: 'Embed into a PNG', detail: 'The serialized payload is prefixed with a fixed header: magic SCQ1, version, quantizer ID, payload length, and a CRC32. Bits are written in row-major RGB order with Quantization Index Modulation at delta 8. The output is re-opened and validated as a lossless PNG.' },
  { title: 'Transfer over TCP', detail: 'The sender opens a socket to the receiver, repeats the authenticated handshake, then sends transfer metadata and numbered 64 KiB image chunks. The receiver checks sequence numbers, offsets, total length, and the final SHA-256 digest.' },
  { title: 'Verify, then reveal', detail: 'The receiver extracts the header, validates capacity and CRC32, decrypts with the derived key, and checks the GCM tag. Plaintext is stored once for the receiver role. Any failure produces a safe error code and no text.' },
];

const limits = [
  { title: 'Lossless images only', detail: 'The payload does not survive JPEG recompression, resizing, cropping, rotation, color conversion, filtering, or social-media processing. PNG in, PNG out.' },
  { title: 'In-memory sessions', detail: 'Restarting the backend removes every room and result. There is no message history, no account system, and no durable storage.' },
  { title: 'Metadata is visible', detail: 'Message contents are hidden, but connection timing, image size, TCP address, session timing, transfer size, and status are observable by the backend and network.' },
  { title: 'Trust comes from configuration', detail: 'Authenticated exchange only helps if the trusted Ed25519 keys are correct. Fingerprints help a person compare identities, but the prototype is not a global identity directory.' },
  { title: 'Compromise is out of scope', detail: 'A compromised backend host, stolen identity key, or compromised browser can read messages or impersonate an endpoint. The browser is not a secure key vault.' },
  { title: 'Not production hardened', detail: 'No TLS termination guide, rate limiting across instances, audit log, distributed session store, hardware-backed keys, or secure deletion guarantees.' },
];

const errorCodes = [
  ['INVALID_REQUEST', 'Malformed or invalid input.'],
  ['UNAUTHORIZED', 'Missing or invalid bearer token.'],
  ['FORBIDDEN', 'Valid token, wrong role for that action.'],
  ['SESSION_NOT_FOUND / SESSION_EXPIRED', 'The room is gone or past its lifetime.'],
  ['JOIN_CODE_INVALID', 'The pairing code is wrong, used, or expired.'],
  ['INVALID_IMAGE / IMAGE_TOO_LARGE', 'The image could not be decoded or is over the limit.'],
  ['MESSAGE_TOO_LARGE', 'The message exceeds 256 KiB of UTF-8 text.'],
  ['INSUFFICIENT_CAPACITY', 'The cover image is too small for this payload.'],
  ['KEY_EXCHANGE_FAILED', 'A signature, identity, or transcript check failed.'],
  ['RECEIVER_UNAVAILABLE / TRANSFER_FAILED', 'The TCP listener or transfer did not complete.'],
  ['INVALID_STEGO_PAYLOAD', 'Header, length, or CRC32 check failed.'],
  ['AUTHENTICATION_FAILED', 'The AES-GCM tag or associated data did not verify.'],
  ['RESULT_NOT_READY', 'The workflow has not produced a retrievable result yet.'],
];

export function AboutPage() {
  return <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
    <header className="max-w-3xl">
      <h1 className="font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">A small system, explained end to end</h1>
      <p className="mt-5 text-base leading-8 text-slate-600">StegoCrypt is an academic prototype that combines authenticated key exchange, AES-256-GCM, QIM image steganography, and length-framed TCP transfer in one runnable workflow. This page covers what each layer does, what the interface is allowed to see, and where the design stops.</p>
    </header>

    <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2 border-y border-slate-200 py-4">
      {sections.map((section) => <a key={section.id} href={`#${section.id}`} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-navy hover:text-navy">{section.label}</a>)}
    </nav>

    <section id="pipeline" className="mt-14 scroll-mt-24">
      <div className="flex items-center gap-2.5"><Layers className="h-5 w-5 text-aqua" aria-hidden="true" /><h2 className="font-display text-3xl tracking-tight text-ink">The pipeline</h2></div>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Every stage below is implemented in its own module with tests, and the interface reports the stages it is currently in.</p>
      <ol className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {pipeline.map((step, index) => <li key={step.title} className="border-t border-slate-200 pt-5">
          <div className="flex items-baseline gap-3"><span className="font-mono text-xs font-bold text-aqua">{String(index + 1).padStart(2, '0')}</span><h3 className="text-base font-bold text-ink">{step.title}</h3></div>
          <p className="mt-2.5 text-sm leading-7 text-slate-600">{step.detail}</p>
        </li>)}
      </ol>
    </section>

    <section id="cryptography" className="mt-16 scroll-mt-24">
      <div className="flex items-center gap-2.5"><LockKeyhole className="h-5 w-5 text-aqua" aria-hidden="true" /><h2 className="font-display text-3xl tracking-tight text-ink">Cryptography, layer by layer</h2></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Spec title="Identity" value="Ed25519" detail="Long-term signing key per endpoint. Only the public key and a SHA-256 fingerprint leave a backend." />
        <Spec title="Handshake" value="X25519 + Ed25519" detail="Fresh ephemeral keys, signed transcript, finished confirmation. Replays are rejected by session and nonce." />
        <Spec title="Key derivation" value="HKDF-SHA256" detail="Transcript hash as salt, a separate info string for message keys, 32 bytes of output." />
        <Spec title="Message" value="AES-256-GCM" detail="Confidentiality and integrity together. A failed tag returns an error, never partial plaintext." />
      </div>
      <div className="mt-6 grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><Fingerprint className="h-4 w-4 text-aqua" />Why the handshake is signed</div>
          <p className="mt-3 text-sm leading-7 text-slate-600">Plain X25519 is unauthenticated, so an active attacker could sit in the middle. StegoCrypt signs the exact handshake transcript with each endpoint's Ed25519 identity and checks the peer against its trusted keys before deriving a key. The transcript hash is then used as the HKDF salt, which ties the final key to that specific exchange.</p>
        </div>
        <div className="rounded-2xl bg-mist/70 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Identity check</div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Both fingerprints appear in the Encryption Lab. Compare them through an independent channel when identity matters; the UI cannot decide who to trust for you.</p>
          <Link to="/encryption" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-navy hover:text-aqua">Open the Encryption Lab<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>

    <section id="steganography" className="mt-16 scroll-mt-24">
      <div className="flex items-center gap-2.5"><ImageIcon className="h-5 w-5 text-aqua" aria-hidden="true" /><h2 className="font-display text-3xl tracking-tight text-ink">Steganography without hand-waving</h2></div>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Steganography does not replace encryption; it hides that a payload exists. QIM maps each payload bit to one of two quantization parities, so extraction does not need the original image. One bit per red, green, and blue sample means an RGB image of width × height has about width × height × 3 bits of capacity.</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#081a2e] p-5 font-mono text-xs text-slate-300">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Stego header, big-endian</div>
          {[['magic', '4 bytes', 'SCQ1'], ['version', '1 byte', '1'], ['quantizer_id', '1 byte', '1'], ['reserved', '2 bytes', '0'], ['payload_length', '4 bytes', 'uint32'], ['payload_crc32', '4 bytes', 'uint32']].map(([name, size, value]) => <div key={name} className="mt-2.5 flex items-baseline justify-between gap-3 border-b border-white/10 pb-2 last:border-0"><span className="text-aqua">{name}</span><span className="text-slate-500">{size}</span><span className="text-slate-300">{value}</span></div>)}
        </div>
        <div>
          <h3 className="text-base font-bold text-ink">Quality and capacity</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">A smaller quantization step changes fewer pixel values but makes bits harder to separate. The prototype starts at delta 8 and measures the result instead of promising a quality figure. PSNR and SSIM are calculated from the original RGB image and the stego image, so the Analysis page reports what actually happened for that message.</p>
          <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm leading-6 text-[#725500]">CRC32 is an extraction sanity check, not security. AES-GCM authentication remains the only authority on whether recovered text is trustworthy.</div>
        </div>
      </div>
    </section>

    <section id="networking" className="mt-16 scroll-mt-24">
      <div className="flex items-center gap-2.5"><Network className="h-5 w-5 text-aqua" aria-hidden="true" /><h2 className="font-display text-3xl tracking-tight text-ink">Networking and framing</h2></div>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">The browser does not open TCP sockets. The backend connects to its receiver listener on loopback for the single-machine demonstration, or to a second machine on a LAN. Frames are a four-byte big-endian length, a one-byte type, and a body. Reads loop until the full frame arrives, and all lengths are checked against configured limits before memory is allocated.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Spec title="Frames" value="uint32 length" detail="Length includes the type byte, excludes the prefix. Oversized frames are rejected." />
        <Spec title="Chunks" value="64 KiB" detail="Numbered, offset-checked, and reassembled in order. Chunk count and total bytes are bounded." />
        <Spec title="Integrity" value="SHA-256 digest" detail="The reconstructed PNG must match the digest declared in transfer metadata." />
        <Spec title="Timeouts" value="Connect · handshake · frame · transfer" detail="Separate limits; a failure closes the socket and stores a safe error code." />
      </div>
    </section>

    <section id="boundaries" className="mt-16 scroll-mt-24">
      <div className="flex items-center gap-2.5"><ShieldCheck className="h-5 w-5 text-aqua" aria-hidden="true" /><h2 className="font-display text-3xl tracking-tight text-ink">What the browser never sees</h2></div>
      <div className="mt-6 grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 lg:grid-cols-[1.15fr_.85fr]">
        <ul className="space-y-3">
          {['Private identity keys and X25519 ephemeral private keys.', 'The derived AES-256-GCM session key.', 'Ciphertext or plaintext inside status responses and logs.', 'Plaintext before the receiver verifies the authentication tag.', 'A sender path to the receiver result endpoint.'].map((item) => <li key={item} className="flex gap-2.5 text-sm leading-6 text-slate-600"><Check className="mt-1 h-4 w-4 shrink-0 text-aqua" aria-hidden="true" />{item}</li>)}
        </ul>
        <div className="rounded-2xl bg-mist/70 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><TriangleAlert className="h-4 w-4 text-gold" />Safe errors, not tracebacks</div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Failures return a stable code and a short message. The client renders those messages directly and never displays partially decrypted material.</p>
        </div>
      </div>
      <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-bold text-ink">Error codes used by the API</summary>
        <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">{errorCodes.map(([code, meaning]) => <div key={code} className="border-t border-slate-100 pt-2.5"><dt className="font-mono text-[11px] font-bold text-navy">{code}</dt><dd className="mt-1 text-xs leading-5 text-slate-500">{meaning}</dd></div>)}</dl>
      </details>
    </section>

    <section id="limitations" className="mt-16 scroll-mt-24">
      <div className="flex items-center gap-2.5"><AlertTriangle className="h-5 w-5 text-coral" aria-hidden="true" /><h2 className="font-display text-3xl tracking-tight text-ink">Limitations and security assumptions</h2></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {limits.map((limit) => <div key={limit.title} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold text-ink">{limit.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{limit.detail}</p></div>)}
      </div>
    </section>

    <section className="mt-14 flex flex-col justify-between gap-5 rounded-3xl bg-navy p-7 text-white shadow-panel sm:flex-row sm:items-center sm:p-9">
      <div>
        <h2 className="font-display text-2xl tracking-tight">See it run instead of reading about it</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Open a receiving room, pair a sender, and watch each phase report its state.</p>
      </div>
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
        <Link to="/receive" className="inline-flex items-center justify-center gap-2 rounded-xl bg-aqua px-5 py-3 text-sm font-bold text-ink"><ArrowRight className="h-4 w-4" />Start receiving</Link>
        <Link to="/send" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Send a message</Link>
      </div>
    </section>
  </div>;
}

function Spec({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</div><div className="mt-2 text-base font-extrabold text-ink">{value}</div><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></div>;
}

"""
StegoCrypt Tunnel Launcher
--------------------------
Starts the backend, creates a cloudflare tunnel for it,
updates the frontend .env.local, starts the frontend dev server,
and creates a tunnel for the frontend.

No source-code files are modified.
"""

import subprocess
import sys
import time
import json
import re
import os
import threading
import http.client

BACKEND_PORT = 8000
FRONTEND_PORT = 5173
PROJECT_DIR = r"c:\Users\devgo\OneDrive\Desktop\dps"
BACKEND_DIR = os.path.join(PROJECT_DIR, "backend")
FRONTEND_DIR = os.path.join(PROJECT_DIR, "frontend")
VENV_PYTHON = os.path.join(BACKEND_DIR, r".venv\Scripts\python.exe")
CLOUDFLARED = r"C:\tools\cloudflared.exe"

procs = []


def stream_output(proc, label):
    for line in iter(proc.stdout.readline, b""):
        pass  # consume silently


def start_backend():
    env = os.environ.copy()
    env["STEGOCRYPT_CORS_ORIGINS"] = "*"  # will be tightened after we have ngrok URLs
    p = subprocess.Popen(
        [VENV_PYTHON, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", str(BACKEND_PORT)],
        cwd=BACKEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    procs.append(p)
    # Wait for backend ready
    for _ in range(30):
        time.sleep(1)
        try:
            conn = http.client.HTTPConnection("127.0.0.1", BACKEND_PORT, timeout=2)
            conn.request("GET", "/api/health")
            r = conn.getresponse()
            if r.status < 500:
                print(f"[backend] Ready on :{BACKEND_PORT}")
                return p
        except Exception:
            pass
    print("[backend] WARNING: backend may not be ready yet")
    return p


def tunnel(port, label):
    """Start a cloudflare quick tunnel and return the public URL."""
    p = subprocess.Popen(
        [CLOUDFLARED, "tunnel", "--url", f"http://localhost:{port}", "--no-autoupdate"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    procs.append(p)
    url = None
    for _ in range(60):
        line = p.stdout.readline().decode("utf-8", errors="replace")
        m = re.search(r"https://[a-z0-9\-]+\.trycloudflare\.com", line)
        if m:
            url = m.group(0)
            print(f"[{label}] Public URL: {url}")
            break
    if not url:
        print(f"[{label}] ERROR: could not detect tunnel URL")
        sys.exit(1)
    # keep draining stdout in background
    threading.Thread(target=stream_output, args=(p, label), daemon=True).start()
    return url, p


def write_env_local(backend_url):
    path = os.path.join(FRONTEND_DIR, ".env.local")
    content = f"VITE_API_BASE_URL={backend_url}\n"
    with open(path, "w") as f:
        f.write(content)
    print(f"[frontend] Wrote {path}")
    print(f"           VITE_API_BASE_URL={backend_url}")


def start_frontend():
    env = os.environ.copy()
    p = subprocess.Popen(
        ["npx", "vite", "--port", str(FRONTEND_PORT), "--host", "0.0.0.0"],
        cwd=FRONTEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        shell=True,
    )
    procs.append(p)
    for _ in range(30):
        time.sleep(1)
        try:
            conn = http.client.HTTPConnection("127.0.0.1", FRONTEND_PORT, timeout=2)
            conn.request("GET", "/")
            r = conn.getresponse()
            if r.status < 500:
                print(f"[frontend] Dev server ready on :{FRONTEND_PORT}")
                return p
        except Exception:
            pass
    print("[frontend] WARNING: frontend may not be ready yet")
    return p


if __name__ == "__main__":
    print("=" * 60)
    print("  StegoCrypt — Cloudflare Tunnel Launcher")
    print("=" * 60)

    print("\n[1/5] Starting backend…")
    start_backend()

    print("\n[2/5] Opening backend tunnel…")
    backend_url, _ = tunnel(BACKEND_PORT, "backend-tunnel")

    print("\n[3/5] Writing frontend environment config…")
    write_env_local(backend_url)

    print("\n[4/5] Starting frontend dev server…")
    start_frontend()

    print("\n[5/5] Opening frontend tunnel…")
    frontend_url, _ = tunnel(FRONTEND_PORT, "frontend-tunnel")

    print("\n" + "=" * 60)
    print("  READY — Share these URLs:")
    print(f"\n  🌐 Frontend (Sender + Receiver):  {frontend_url}")
    print(f"  🔧 Backend API:                   {backend_url}")
    print("\n  Both computers open the FRONTEND URL.")
    print("  Receiver goes to /receive, Sender goes to /send.")
    print("=" * 60)
    print("\nPress Ctrl+C to stop all servers.\n")

    try:
        while True:
            time.sleep(5)
            for p in procs:
                if p.poll() is not None:
                    print(f"[WARNING] A process exited with code {p.returncode}")
    except KeyboardInterrupt:
        print("\nShutting down…")
        for p in procs:
            p.terminate()

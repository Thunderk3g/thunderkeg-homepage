'use client';

import '@xterm/xterm/css/xterm.css';
import './vm.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import type { FitAddon as XFitAddon } from '@xterm/addon-fit';
import type { V86 as V86Emulator } from 'v86';
import type { AppDefinition, AppProps } from '../../types';
import { useOS } from '../../store';
import { GUEST, PROMPT_RE, collectPortfolio } from './guest';

/**
 * Virtual Machine — boots a real Linux 6.8 kernel (Buildroot + BusyBox, i686)
 * inside v86, an x86 PC emulator compiled to WebAssembly. The default console
 * is the guest's first serial port (ttyS0) rendered with xterm.js; the VGA
 * screen stays attached (hidden) and can be switched to.
 *
 * Keyboard capture is scoped: v86's document-wide keyboard adapter is kept
 * disabled except while the VGA screen has focus, and serial input only comes
 * from xterm, so the rest of the desktop keeps its shortcuts.
 */

type Phase = 'idle' | 'downloading' | 'booting' | 'running' | 'paused' | 'error';
type ConsoleKind = 'serial' | 'vga';

interface Session {
  disposed: boolean;
  emu: V86Emulator | null;
  term: XTerm | null;
  fit: XFitAddon | null;
  /** output bytes waiting for the next batched term.write */
  pending: number[];
  flushTimer: number | null;
  /** last few chars of serial output, for prompt / sentinel detection */
  tail: string;
  /** while set, guest output is hidden (our own setup commands) */
  swallow: { buf: string; timer: number } | null;
  setupDone: boolean;
  filesWritten: boolean;
  /** boot() in progress (download / module load), before s.emu exists */
  starting: boolean;
  /** number of portfolio files written into the 9p share */
  shared: number;
  bootStart: number;
  bootMs: number | null;
  /** the downloaded bzImage, kept for resets and re-boots */
  kernel: ArrayBuffer | null;
}

const enc = new TextEncoder();

/**
 * v86's ESM build contains Node-only branches (`import("node:crypto")`,
 * `import("node:fs/promises")`) that webpack cannot bundle, so the module is
 * served as-is from /vm/libv86.mjs (copied there from node_modules/v86 by
 * scripts/copy-vm-assets.mjs) and loaded at runtime, outside the bundle.
 * Types still come from the package's v86.d.ts.
 */
const loadV86 = (): Promise<typeof import('v86')> =>
  import(/* webpackIgnore: true */ /* turbopackIgnore: true */ '/vm/libv86.mjs' as string);
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const SENTINEL_RE = /__KOS_DONE_(up|down)\r?\n/;

function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function xtermTheme(el: Element) {
  const accent = cssVar(el, '--kos-accent', '#33aaff');
  return {
    background: 'rgba(0,0,0,0)',
    foreground: cssVar(el, '--kos-text', '#e6e6e6'),
    cursor: accent,
    cursorAccent: '#000000',
    selectionBackground: accent + '55',
    black: '#1d1f21',
    red: '#ff5f56',
    green: cssVar(el, '--kos-good', '#5af78e'),
    yellow: '#f3f99d',
    blue: accent,
    magenta: '#ff6ac1',
    cyan: '#9aedfe',
    white: '#e6e6e6',
    brightBlack: '#686868',
    brightBlue: accent,
  };
}

function fmtMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function VirtualMachine({ args }: AppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const serialRef = useRef<HTMLDivElement>(null);
  const vgaRef = useRef<HTMLDivElement>(null);
  const vgaScreenRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<Session | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: GUEST.kernelSize });
  const [error, setError] = useState<string | null>(null);
  const [consoleKind, setConsoleKind] = useState<ConsoleKind>('serial');
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);
  const consoleRef = useRef<ConsoleKind>('serial');
  consoleRef.current = consoleKind;
  const theme = useOS((s) => s.settings.theme);

  /* ---------- xterm (created once per mount) ---------- */
  useEffect(() => {
    const s: Session = {
      disposed: false,
      emu: null,
      term: null,
      fit: null,
      pending: [],
      flushTimer: null,
      tail: '',
      swallow: null,
      setupDone: false,
      filesWritten: false,
      starting: false,
      shared: 0,
      bootStart: 0,
      bootMs: null,
      kernel: null,
    };
    sessionRef.current = s;
    let ro: ResizeObserver | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]);
      const host = serialRef.current;
      if (s.disposed || !host || !rootRef.current) return;
      const mono = cssVar(rootRef.current, '--font-mono', '');
      const term = new Terminal({
        allowTransparency: true,
        convertEol: false,
        cursorBlink: true,
        fontFamily: `${mono ? mono + ', ' : ''}ui-monospace, Menlo, monospace`,
        fontSize: 13,
        lineHeight: 1.15,
        scrollback: 5000,
        theme: xtermTheme(rootRef.current),
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host);
      s.term = term;
      s.fit = fit;
      try {
        fit.fit();
      } catch {
        /* zero-size container */
      }
      term.onData((d) => {
        const emu = s.emu;
        if (!emu) return;
        // serial0_send() only takes code units < 256; send UTF-8 bytes instead
        emu.serial_send_bytes(0, enc.encode(d));
      });
      ro = new ResizeObserver(() => {
        if (s.disposed) return;
        try {
          fit.fit();
        } catch {
          /* hidden */
        }
      });
      ro.observe(host);
      (window as unknown as { __vm?: unknown }).__vm = {
        get term() {
          return s.term;
        },
        get emu() {
          return s.emu;
        },
        get bootMs() {
          return s.bootMs;
        },
        get ready() {
          return s.setupDone;
        },
        text() {
          const t = s.term;
          if (!t) return '';
          const b = t.buffer.active;
          const out: string[] = [];
          for (let i = 0; i < b.length; i++) out.push(b.getLine(i)?.translateToString(true) ?? '');
          return out.join('\n');
        },
      };
      setReady(true);
    })();

    return () => {
      s.disposed = true;
      ro?.disconnect();
      if (s.flushTimer !== null) window.clearTimeout(s.flushTimer);
      if (s.swallow) window.clearTimeout(s.swallow.timer);
      const emu = s.emu;
      s.emu = null;
      if (emu) {
        void (async () => {
          try {
            await emu.stop();
          } catch {
            /* already stopped */
          }
          try {
            await emu.destroy();
          } catch {
            /* ignore */
          }
        })();
      }
      s.term?.dispose();
      s.term = null;
      const w = window as unknown as { __vm?: unknown };
      if (sessionRef.current === s) {
        sessionRef.current = null;
        delete w.__vm;
      }
    };
  }, []);

  /* follow desktop theme changes */
  useEffect(() => {
    const t = sessionRef.current?.term;
    if (t && rootRef.current) t.options.theme = xtermTheme(rootRef.current);
  }, [theme, ready]);

  /* ---------- serial output plumbing ---------- */
  const note = useCallback((text: string) => {
    sessionRef.current?.term?.write(`${DIM}${text}${RESET}`);
  }, []);

  const setupGuest = useCallback(async (s: Session) => {
    const emu = s.emu;
    if (!emu || !s.term) return;
    s.setupDone = true;
    s.bootMs = Date.now() - s.bootStart;

    // 1) portfolio -> 9p share (mounted on /mnt by the guest's fstab)
    if (!s.filesWritten) {
      try {
        const { dirs, files } = collectPortfolio(useOS.getState().fs);
        const fs9p = (emu as unknown as {
          fs9p?: {
            SearchPath(p: string): { id: number; parentid: number };
            CreateDirectory(name: string, parent: number): number;
          };
        }).fs9p;
        const mkdir = (rel: string) => {
          if (!fs9p) return;
          const full = `/${GUEST.shareDir}${rel ? '/' + rel : ''}`;
          const found = fs9p.SearchPath(full);
          if (found.id !== -1 || found.parentid === -1) return;
          fs9p.CreateDirectory(full.split('/').pop()!, found.parentid);
        };
        mkdir('');
        for (const d of dirs) mkdir(d);
        for (const [rel, content] of files) {
          await emu.create_file(`/${GUEST.shareDir}/${rel}`, enc.encode(content));
          s.shared++;
        }
        s.filesWritten = true;
      } catch (err) {
        console.warn('[vm] could not write portfolio into 9p share', err);
      }
    }
    if (s.disposed || s.emu !== emu) return;

    // 2) bring up networking with output hidden; the sentinel ends the hiding
    s.term.write('\r\x1b[2K');
    s.swallow = {
      buf: '',
      timer: window.setTimeout(() => {
        finishSetup(s, 'down');
        s.emu?.serial0_send('\n'); // no prompt came back; ask for one
      }, 25_000),
    };
    // a serial line has no window size, so tell the tty what xterm shows
    const { cols, rows } = s.term;
    emu.serial0_send(
      `stty cols ${cols} rows ${rows}; udhcpc -q -n -t 4 -T 2 >/dev/null 2>&1 && N=up || N=down; ` +
        'hostname kali-vm; echo __KOS_""DONE_$N\n',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishSetup = useCallback(
    (s: Session, net: string) => {
      if (!s.swallow) return;
      window.clearTimeout(s.swallow.timer);
      s.swallow = null;
      const n = s.shared;
      const secs = s.bootMs !== null ? (s.bootMs / 1000).toFixed(1) : '?';
      note(`\r\n  ${GUEST.kernel} booted in ${secs} s · ${GUEST.memoryMB} MB RAM · real kernel on emulated x86 (v86)\r\n`);
      if (n) note(`  portfolio (9p):  ls ${GUEST.mount}/${GUEST.shareDir}  ·  cat ${GUEST.mount}/${GUEST.shareDir}/README\r\n`);
      note(
        net === 'up'
          ? '  network (DHCP):  wget -qO- http://example.com | head  ·  wget -qO- http://portfolio/api/content\r\n'
          : '  network did not come up; try:  udhcpc\r\n',
      );
      setPhase((p) => (p === 'booting' ? 'running' : p));
      // the guest's own prompt (still to arrive) lands below these notes
    },
    [note],
  );

  const onSerialByte = useCallback(
    (s: Session, byte: number) => {
      if (s.disposed) return;
      const ch = String.fromCharCode(byte);
      if (s.swallow) {
        s.swallow.buf += ch;
        const m = SENTINEL_RE.exec(s.swallow.buf);
        if (m) finishSetup(s, m[1]);
        return;
      }
      s.tail = (s.tail + ch).slice(-32);
      s.pending.push(byte);
      if (s.flushTimer === null) {
        s.flushTimer = window.setTimeout(() => {
          s.flushTimer = null;
          if (s.pending.length && s.term) s.term.write(Uint8Array.from(s.pending));
          s.pending = [];
        }, 8);
      }
      if (!s.setupDone && PROMPT_RE.test(s.tail)) {
        // flush what we have before the setup touches the screen
        window.setTimeout(() => void setupGuest(s), 30);
        s.setupDone = true;
      }
    },
    [finishSetup, setupGuest],
  );

  /* ---------- boot ---------- */
  /** fetch the bzImage with a ReadableStream so the toolbar can show progress */
  const downloadKernel = useCallback(async (s: Session): Promise<ArrayBuffer | null> => {
    setPhase('downloading');
    setProgress({ loaded: 0, total: GUEST.kernelSize });
    const res = await fetch(GUEST.kernelUrl);
    if (!res.ok) throw new Error(`Kernel download failed: HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || GUEST.kernelSize;
    if (!res.body) return res.arrayBuffer();
    const reader = res.body.getReader();
    const out = new Uint8Array(Math.max(total, GUEST.kernelSize));
    let loaded = 0;
    let lastTick = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (s.disposed) {
        await reader.cancel();
        return null;
      }
      if (loaded + value.byteLength > out.length) throw new Error('Kernel download larger than expected');
      out.set(value, loaded);
      loaded += value.byteLength;
      const now = performance.now();
      if (now - lastTick > 80) {
        lastTick = now;
        setProgress({ loaded, total });
      }
    }
    setProgress({ loaded, total });
    return out.buffer.slice(0, loaded);
  }, []);

  const boot = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || s.emu || s.starting || !s.term) return;
    s.starting = true;
    setError(null);
    setHelp(false);
    s.bootStart = Date.now();
    s.setupDone = false;
    s.filesWritten = false;
    s.shared = 0;
    s.bootMs = null;
    try {
      if (typeof WebAssembly !== 'object') throw new Error('This browser has no WebAssembly support, which the emulator needs.');

      // kernel, with progress (downloaded once per window)
      if (!s.kernel) s.kernel = await downloadKernel(s);
      if (s.disposed || !s.kernel) return;
      const buffer = s.kernel.slice(0);

      setPhase('booting');
      const { V86 } = await loadV86();
      if (s.disposed) return;


      s.term.write(`${DIM}[host] starting v86: ${GUEST.memoryMB} MB RAM, SeaBIOS, ${GUEST.kernel} bzImage (${fmtMB(buffer.byteLength)} MB)…${RESET}\r\n`);
      const vgaActive = consoleRef.current === 'vga';
      const emu = new V86({
        wasm_path: '/vm/v86.wasm',
        memory_size: GUEST.memoryMB * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        bios: { url: '/vm/seabios.bin' },
        vga_bios: { url: '/vm/vgabios.bin' },
        bzimage: { buffer },
        cmdline: GUEST.cmdline,
        filesystem: {},
        autostart: true,
        screen: { container: vgaScreenRef.current },
        // the keyboard adapter listens on window; it stays disabled (below)
        // except while the VGA screen is focused
        disable_keyboard: false,
        disable_mouse: !vgaActive,
        net_device: { type: 'virtio', relay_url: 'fetch', cors_proxy: '/api/vm/proxy?url=' },
      });
      s.emu = emu;
      // v86 creates its (window-wide) keyboard/mouse adapters only once the
      // wasm core has loaded, enabled; switch them off as soon as they exist
      const scopeInput = () => {
        const vgaFocused = !!vgaRef.current && document.activeElement === vgaRef.current;
        emu.keyboard_set_enabled(vgaFocused);
        emu.mouse_set_enabled(vgaFocused);
      };
      scopeInput();
      emu.add_listener('emulator-loaded', scopeInput);
      s.starting = false;

      emu.add_listener('serial0-output-byte', (b: number) => onSerialByte(s, b));
      emu.add_listener('emulator-stopped', () => {
        if (!s.disposed && s.emu === emu) setPhase((p) => (p === 'error' ? p : 'paused'));
      });
      emu.add_listener('emulator-started', () => {
        if (!s.disposed && s.emu === emu) setPhase(s.setupDone && !s.swallow ? 'running' : 'booting');
      });
      emu.add_listener('download-error', () => {
        if (!s.disposed) {
          setError('Could not download the BIOS images from /vm/.');
          setPhase('error');
        }
      });
      if (consoleRef.current === 'serial') s.term.focus();
    } catch (err) {
      s.starting = false;
      if (s.disposed) return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(/fetch|network/i.test(msg) ? `Network error while downloading the kernel: ${msg}` : msg);
      setPhase('error');
      const emu = s.emu;
      s.emu = null;
      if (emu) void emu.destroy().catch(() => {});
    }
  }, [onSerialByte, downloadKernel]);

  /* autoboot when launched from the terminal (`vm`) */
  // keyed on the args object: each `vm` from the terminal is a fresh request,
  // but powering off must not immediately boot again
  const handledArgs = useRef<unknown>(null);
  useEffect(() => {
    if (!ready || args?.autoboot !== true || handledArgs.current === args) return;
    if (phase !== 'idle' && phase !== 'error') {
      handledArgs.current = args;
      return;
    }
    const t = window.setTimeout(() => {
      handledArgs.current = args;
      void boot();
    }, 0);
    return () => window.clearTimeout(t);
  }, [ready, args, phase, boot]);

  /* ---------- controls ---------- */
  const togglePause = async () => {
    const emu = sessionRef.current?.emu;
    if (!emu) return;
    if (emu.is_running()) {
      await emu.stop();
      setPhase('paused');
    } else {
      await emu.run();
      const s = sessionRef.current;
      setPhase(s?.setupDone && !s.swallow ? 'running' : 'booting');
    }
  };

  const reset = () => {
    const s = sessionRef.current;
    const emu = s?.emu;
    if (!s || !emu) return;
    if (s.swallow) {
      window.clearTimeout(s.swallow.timer);
      s.swallow = null;
    }
    s.tail = '';
    note('\r\n[host] reset: power-cycling the machine…\r\n');
    // v86's restart() resets the CPU but does not reload a bzImage passed as
    // a buffer (it stops at SeaBIOS with no boot device), so a reset is a
    // fresh emulator built from the cached kernel.
    s.emu = null;
    void (async () => {
      try {
        await emu.stop();
        await emu.destroy();
      } catch {
        /* ignore */
      }
      void boot();
    })();
    setPhase('booting');
  };

  const powerOff = async () => {
    const s = sessionRef.current;
    const emu = s?.emu;
    if (!s || !emu) return;
    s.emu = null;
    if (s.swallow) {
      window.clearTimeout(s.swallow.timer);
      s.swallow = null;
    }
    try {
      await emu.stop();
      await emu.destroy();
    } catch {
      /* ignore */
    }
    s.term?.reset();
    setPhase('idle');
  };

  const switchConsole = (kind: ConsoleKind) => {
    setConsoleKind(kind);
    const s = sessionRef.current;
    window.setTimeout(() => {
      if (kind === 'vga') vgaRef.current?.focus();
      else {
        try {
          s?.fit?.fit();
        } catch {
          /* hidden */
        }
        s?.term?.focus();
      }
    }, 0);
  };

  const onVgaFocus = (on: boolean) => {
    const emu = sessionRef.current?.emu;
    if (!emu) return;
    emu.keyboard_set_enabled(on);
    emu.mouse_set_enabled(on);
  };

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  /* ---------- render ---------- */
  const booted = phase === 'booting' || phase === 'running' || phase === 'paused';
  const pct = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
  const status =
    phase === 'idle'
      ? 'powered off'
      : phase === 'downloading'
        ? `downloading kernel ${fmtMB(progress.loaded)}/${fmtMB(progress.total)} MB`
        : phase === 'booting'
          ? 'booting'
          : phase === 'running'
            ? `running · ${GUEST.memoryMB} MB · ${GUEST.kernel}`
            : phase === 'paused'
              ? `paused · ${GUEST.kernel}`
              : 'error';

  return (
    <div ref={rootRef} className="kos-vm" data-testid="vm-root">
      <div className="kos-vm-bar">
        <span className="kos-vm-pill" data-phase={phase} role="status" aria-live="polite">
          <span className="kos-vm-dot" />
          <span className="kos-vm-status">{status}</span>
          {phase === 'downloading' && (
            <span className="kos-vm-progress" aria-hidden>
              <span style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
        <span className="kos-vm-spacer" />
        <span className="kos-vm-group">
          {booted ? (
            <>
              <button className="kos-vm-btn" onClick={() => void togglePause()} title="Pause / resume the CPU">
                {phase === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button className="kos-vm-btn" onClick={reset} title="Hard reset (reboot) the machine">
                Reset
              </button>
              <button className="kos-vm-btn" onClick={() => void powerOff()} title="Power off and free the memory">
                Power off
              </button>
            </>
          ) : (
            <button
              className="kos-vm-btn"
              onClick={() => void boot()}
              disabled={!ready || phase === 'downloading'}
              title="Download the kernel and boot"
            >
              Start
            </button>
          )}
        </span>
        <span className="kos-vm-seg" role="group" aria-label="Console">
          <span>Console</span>
          <button aria-pressed={consoleKind === 'serial'} onClick={() => switchConsole('serial')} title="Serial port ttyS0 (xterm.js)">
            Serial
          </button>
          <button aria-pressed={consoleKind === 'vga'} onClick={() => switchConsole('vga')} title="Emulated VGA screen (tty1)">
            VGA
          </button>
        </span>
        <button className="kos-vm-btn" onClick={toggleFullscreen} title="Fullscreen">
          Fullscreen
        </button>
        <button
          className="kos-vm-btn"
          onClick={() => setHelp((h) => !h)}
          aria-expanded={help}
          title="What is this?"
        >
          ?
        </button>
        {help && (
          <div className="kos-vm-help" role="dialog" aria-label="About the virtual machine">
            <h4>What is real here</h4>
            <p>
              Everything inside the console. v86 emulates an x86 PC (CPU, RAM, BIOS, VGA, serial port, virtio
              network and 9p) in WebAssembly, and that PC boots an unmodified {GUEST.kernel} kernel with a BusyBox
              userland. Commands run as real i686 machine code.
            </p>
            <ul>
              <li>
                <b>Serial</b> is ttyS0 shown in xterm.js; <b>VGA</b> is the emulated screen (tty1). Click it to give
                it the keyboard.
              </li>
              <li>
                Portfolio files are shared over 9p at <code>{GUEST.mount}/{GUEST.shareDir}</code>.
              </li>
              <li>
                HTTP from the guest becomes browser fetch() through an allowlisted proxy:{' '}
                <code>wget -qO- http://example.com</code>
              </li>
              <li>Nothing leaves your tab; closing the window discards the machine.</li>
            </ul>
            <p style={{ margin: 0, color: 'var(--kos-dim)' }}>A physical keyboard works best.</p>
          </div>
        )}
      </div>

      <div className="kos-vm-stage">
        <div
          ref={serialRef}
          className="kos-vm-serial"
          style={{ display: consoleKind === 'serial' ? 'block' : 'none' }}
          onPointerUp={() => sessionRef.current?.term?.focus()}
        />
        <div
          ref={vgaRef}
          className="kos-vm-vga"
          tabIndex={0}
          aria-label="VGA screen (click to type)"
          style={{ display: consoleKind === 'vga' ? 'flex' : 'none' }}
          onFocus={() => onVgaFocus(true)}
          onBlur={() => onVgaFocus(false)}
          onPointerDown={() => vgaRef.current?.focus()}
        >
          <div ref={vgaScreenRef} className="kos-vm-vga-screen">
            <div />
            <canvas style={{ display: 'none' }} />
          </div>
          <span className="kos-vm-vga-hint">click the screen to type · Serial console is the easier one</span>
        </div>

        {(phase === 'idle' || phase === 'downloading' || phase === 'error') && (
          <div className="kos-vm-card-wrap">
            <div className="kos-vm-card">
              <div className="kos-vm-eyebrow">virtual machine · x86 · webassembly</div>
              <h3>This is a real operating system</h3>
              <p>
                Not a simulation: pressing Boot downloads a {GUEST.kernel} kernel and boots it on an x86 PC emulated in
                your browser by v86. You get a root shell on a real Linux system.
              </p>
              <dl className="kos-vm-specs">
                <dt>kernel</dt>
                <dd>{GUEST.kernel} (i686) · Buildroot · BusyBox</dd>
                <dt>machine</dt>
                <dd>{GUEST.memoryMB} MB RAM · SeaBIOS · VGA · ttyS0 · virtio-net · virtio-9p</dd>
                <dt>download</dt>
                <dd>{fmtMB(GUEST.kernelSize)} MB kernel + 2 MB emulator, once</dd>
              </dl>
              <ul className="kos-vm-works">
                <li>
                  <b>shell</b> on the serial console: <code>uname -a</code>, <code>top</code>, <code>dmesg</code>
                </li>
                <li>
                  <b>your portfolio inside the VM</b> over 9p: <code>ls {GUEST.mount}/{GUEST.shareDir}</code>
                </li>
                <li>
                  <b>networking</b> via DHCP + browser fetch: <code>wget -qO- http://example.com</code>
                </li>
              </ul>
              {error && <div className="kos-vm-error">{error}</div>}
              <div className="kos-vm-cta">
                <button className="kos-vm-boot" onClick={() => void boot()} disabled={!ready || phase === 'downloading'}>
                  {phase === 'downloading' ? `Downloading ${pct}%` : phase === 'error' ? 'Try again' : 'Boot'}
                </button>
                <span className="kos-vm-note">A physical keyboard works best; on a phone, tap the console to type.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const vmApp: AppDefinition = {
  id: 'vm',
  title: 'Linux VM',
  icon: '🐧',
  category: 'System',
  component: VirtualMachine,
  desktop: true,
  defaultSize: { width: 900, height: 600 },
  minSize: { width: 480, height: 320 },
  launchCommands: ['vm', 'qemu', 'virt-manager', 'linux'],
  description: 'A real Linux 6.8 kernel booted in an x86 emulator (v86) — not a simulation',
};

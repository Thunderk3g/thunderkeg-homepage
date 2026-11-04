# Research: making the portfolio a real Kali Linux desktop in the browser

Date: 2026-11-04. Everything below was checked against primary sources (the
v86 and PGlite repositories and npm tarballs, Kali's own packaging on
gitlab.com/kalilinux, KDE's Dolphin handbook). Where a host could not be
reached from the build environment it is said so.

## 1. Decision summary

| Need | Chosen | Why |
|---|---|---|
| A real OS running in the browser | **v86** (`v86@0.5.473`, BSD-2) booting the v86 project's **Buildroot Linux 6.8.12** kernel image | Pure JS/WASM, no COOP/COEP headers, boots in seconds, serial console drives xterm.js, `fetch`-mode networking needs no server, 9p share lets us drop the portfolio files into the guest |
| A real database in the browser ("the elephant") | **PGlite** (`@electric-sql/pglite@0.5.15`, Apache-2.0 / PostgreSQL licence) | Real PostgreSQL 18.6 compiled to WASM, ~5 MB over the wire, persists to IndexedDB, lazy-loaded |
| File manager ("the dolphin") | KDE **Dolphin**-style rewrite of the Files app | Kali's KDE edition ships Dolphin; it is the richest file-manager model (places, breadcrumb, split view, info panel, F4 terminal) |
| Visual identity | Kali 2026.x **Kali-Dark** Xfce look, original artwork | Faithful proportions, palette and fonts; no trademark artwork |

### Rejected alternatives
- **CheerpX / WebVM**: engine is proprietary and always loaded from Leaning Tech's CDN; businesses only get a technical-evaluation licence; needs `Cross-Origin-Embedder-Policy: require-corp`, which would break every third-party iframe on the site (DOOM, etc.); the Debian disk image is far too large to self-host.
- **JSLinux**: no redistribution licence for the web bundle.
- **container2wasm**: Apache-2.0 but experimental, large and slow compared with v86's JIT.
- **MySQL/MariaDB in the browser**: does not exist as a client-side WASM build. The only "dolphin" we can honestly ship is Dolphin the file manager.

## 2. v86 facts that shaped the implementation

- npm package `v86` is published from GitHub Actions with provenance; `main` is `build/libv86.mjs`, types in `v86.d.ts`. It ships **no BIOS and no OS images** — `bios/seabios.bin` and `bios/vgabios.bin` come from the repo, images from `https://i.copy.sh/` (the copy.sh demo host, which this environment could not reach).
- Image used: `buildroot-bzimage68.bin` (10,068,480 bytes, Linux 6.8.12, BusyBox + Lua, root shell on serial with prompt `~% `). Obtained from a public mirror and **verified against the upstream SHA-256** `507a759c70ab7a490a233be454d0b5b88bc667956a410b531cb4edc091e2eb1c`; SeaBIOS `73e3f359…4d98`, VGA BIOS `a4bc0d80…7880`. See `public/vm/SOURCES.md`.
- Boot options from v86's own profile: `cmdline: "tsc=reliable mitigations=off random.trust_cpu=on"`, `filesystem: {}` (empty 9p share, mount tag `host9p`), 128 MB RAM.
- Console: `serial_console: { type: 'xtermjs', container, xterm_lib }` or the `serial0-output-byte` event + `serial0_send()`. There is no `serial0-output-string` event in the current API.
- Networking: `net_device: { type: 'virtio', relay_url: 'fetch', cors_proxy }` turns guest HTTP into browser `fetch()`; DHCP/ARP are answered internally (`udhcpc` in the guest); browser CORS applies, so an allow-listed server-side proxy is needed for arbitrary hosts.
- Keyboard: v86 grabs the whole document by default; scope it with `disable_keyboard` / `keyboard_set_enabled()` so the rest of the desktop keeps working.
- Hosting limits that matter: GitHub blocks files over 100 MiB (warns at 50 MiB); Vercel Hobby deployments are capped around 100 MB of static upload. A 10 MB kernel plus 2 MB WASM fits comfortably. The WASM is copied from `node_modules` at build time rather than committed.

## 3. PGlite facts

- PostgreSQL 18.6 in WASM, single connection, `PGlite.create({ dataDir: 'idb://…', relaxedDurability: true })` for IndexedDB persistence.
- Measured here under Node: cold start ~3.0 s; `select version()` returns `PostgreSQL 18.6 (PGlite 0.5.15) on wasm32-unknown-emscripten`.
- Next.js 15 notes from the upstream issue tracker: if `next build` fails on PGlite with a Terser module error, add `serverExternalPackages: ['@electric-sql/pglite']`; the multi-tab worker does not work under Turbopack, so it is not used.
- `dumpDataDir()` returns a tarball Blob for backups; `@electric-sql/pglite-tools` offers a WASM `pg_dump` if ever needed.

## 4. The real Kali desktop (kali-themes 2026.4.1, kali-defaults, kali-wallpapers 2026.3.0)

- **Panel**: one top panel, 34 px, opaque. Left to right: Whisker menu (dragon icon), separator, show-desktop, directory menu, launchers (text editor, browser, terminal), separator, 4-workspace pager, separator, icon-only grouped task list, expanding separator, CPU graph (128 px, bars, `#2777FF` / `#00FFE0`), systray (22 px), VPN-IP indicator, volume, notifications, battery, clock `%_H:%M` in Cantarell 11, lock and logout buttons.
- **Fonts**: UI Cantarell 11; monospace Fira Code Medium 10; window titles Cantarell Bold 9.
- **Kali-Dark colours**: surfaces `#23252E`, text `#EEEEEC`, headerbar `#0D0E11` with gradient `#16171D → #1A1C23`, inactive title text `#8C8F94`, accent/selection **`#2777FF`** (`#367BF0` is only the terminal blue), radii 4 px controls / 7 px window top corners / 8 px popovers. Windows are opaque; the terminal is 95 % opaque. xfwm4 shadows 40 % opacity, offset 2 px upward; button layout `O|HMC`.
- **QTerminal Kali-Dark palette**: bg `#23252E`, fg `#FFFFFF`, blue `#367BF0/#277FFF`, green `#5EBDAB/#47D4B9`, red `#D41919/#EC0101`, yellow `#FEA44C/#FF8A18`, magenta `#9755B3/#962AC3`, cyan `#49AEE6/#05A1F7`. Two-line zsh prompt `┌──(kali㉿kali)-[~]` / `└─$`.
- **Whisker menu**: 570 × 700, search on top, apps left, categories right, footer with Settings and Log out.
- **Wallpaper**: since 2026.1 the default is `kali-cubes` (isometric cubes, blue/purple), with a blurred variant for login. All Kali wallpapers are GPL-3 but their graphical elements are trademark-protected, so the site uses original artwork.
- **Boot and login**: Plymouth theme is an outlined dragon that fills in; LightDM GTK greeter uses the light theme on a blurred wallpaper with a `%d %b, %H:%M` clock.
- **Kali Undercover**: Windows-10 theme, bottom 44 px panel, Liberation Sans, notifications off; Kali 2026.1 added **BackTrack mode** (red theme, buttons on the left).
- **Shortcuts**: Ctrl+Alt+T / Super+T terminal, Super+E files, Super+W browser, Super+L lock, Alt+F1 menu, Alt+Tab cycle, Alt+F4 close, Super+Up/Down/Left/Right tile, Super+D show desktop, Ctrl+Alt+←/→ workspaces, Alt+F11 fullscreen; "Kali HiDPI mode" doubles scaling.
- **Dolphin defaults**: breadcrumb location bar (Ctrl+L to edit), Places panel (F9), Information panel (F11), Terminal panel (F4), Icons/Compact/Details views (Ctrl+1/2/3), split view (F3), filter bar (Ctrl+I), zoom slider in the status bar.

## 5. Trademark

"Kali Linux" and the dragon logo are OffSec trademarks; the policy forbids modifying the marks or using them commercially without permission, and the EULA requires replacing all trademark images in modified builds. Consequence for this site: original dragon-ish mark and wallpapers only, and the notice **"KALI LINUX ™ is a trademark of OffSec"** in the About dialog.

## 6. Design references and techniques

Studied: daedalOS (dustinbrett.com), Vivek Patel's Ubuntu portfolio, Win11React, playground-macos, Puter, and the CSS Nectar-awarded "Alicja's Desktop". Techniques carried over: open/close as `scale .95→1` + fade over 200–250 ms with the transform origin at the launcher; minimize tweens toward the task button's centre; layered shadow stacks that change with focus; drag via pointer events and transforms; translucent accent-tinted snap previews; Whisker scale-in from its button; a Plymouth-style outline-fill boot; skeleton chrome while heavy modules (v86, PGlite) report real progress; all durations collapse to zero under reduced motion.

Icon licensing: Flat-Remix (what Kali ships), Papirus, Tela and Numix are GPL-3 and carry third-party app logos, so they are not bundled. Lucide (ISC) covers symbolic glyphs; app launcher plates are drawn originally in a Flat-Remix-like style.

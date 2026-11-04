# Virtual Machine binaries: provenance and licences

The Virtual Machine app (`src/os/apps/vm/`) boots a real Linux kernel in the
visitor's browser using [v86](https://github.com/copy/v86), an x86 PC emulator
compiled to WebAssembly. Every binary in this folder comes from the v86 project
and is redistributed **unmodified**.

| File | Size (bytes) | SHA-256 | What it is | Licence |
| --- | ---: | --- | --- | --- |
| `buildroot-bzimage68.bin` | 10,068,480 | `507a759c70ab7a490a233be454d0b5b88bc667956a410b531cb4edc091e2eb1c` | Linux 6.8.12 bzImage with a Buildroot initramfs (BusyBox userland), i686 | GPL-2.0 (Linux kernel, BusyBox, other Buildroot packages under their own licences) |
| `seabios.bin` | 131,072 | `73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98` | SeaBIOS PC BIOS | LGPL-3.0 |
| `vgabios.bin` | 36,352 | `a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880` | SeaVGABIOS VGA BIOS (built from SeaBIOS) | LGPL-3.0 |
| `v86.wasm` | (generated) | (from the npm package) | v86 emulator core | BSD-2-Clause |
| `v86-fallback.wasm` | (generated) | (from the npm package) | v86 core for browsers without WASM extensions | BSD-2-Clause |
| `libv86.mjs` | (generated) | (from the npm package) | v86 JavaScript/ESM loader (loaded at runtime, not bundled) | BSD-2-Clause |

## Origin

- Kernel image and BIOS files: the v86 project, <https://github.com/copy/v86>
  (the same `buildroot-bzimage68.bin`, `seabios.bin` and `vgabios.bin` the v86
  demo at <https://copy.sh/v86/> boots).
- `v86.wasm`, `v86-fallback.wasm` and `libv86.mjs` are **not committed**. They are copied
  from `node_modules/v86/build/` (npm package `v86@0.5.473`, BSD-2-Clause) by
  `scripts/copy-vm-assets.mjs`, which runs on `postinstall` and `prebuild`.
  `public/vm/*.wasm` and `public/vm/libv86.mjs` are listed in `.gitignore`.

Verify the committed files with:

```sh
sha256sum public/vm/*.bin
```

## Source code / rebuilding

The kernel image is built by v86's Buildroot configuration in
[`tools/docker/buildroot`](https://github.com/copy/v86/tree/master/tools/docker/buildroot)
of the v86 repository (Docker-based: it fetches Buildroot, applies v86's
defconfig and kernel config, and produces `bzImage` with an embedded
initramfs). The corresponding source for the GPL components is that Buildroot
configuration plus the upstream Linux 6.8.12 and BusyBox releases it pins.

SeaBIOS and SeaVGABIOS sources: <https://www.seabios.org/> (v86 builds them
with the config in its repository's `bios/` folder).

## What the guest does at boot (observed)

- BusyBox init spawns a root shell on the VGA console (tty1) and on the first
  serial port (`ttyS0::respawn:-/bin/sh` in `/etc/inittab`).
- `/etc/fstab` mounts the emulator's 9p share (`host9p`, virtio transport) on
  `/mnt`; the app writes the portfolio documents to `/mnt/portfolio/`.
- Networking is off until `udhcpc` runs; the app runs it after boot. v86's
  `fetch` backend turns guest HTTP (port 80) into browser `fetch()` calls,
  routed through `/api/vm/proxy` (a small host allowlist).

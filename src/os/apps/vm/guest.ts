import type { FsNode } from '../../types';
import type { FileSystem } from '../../fs/filesystem';

/** Facts about the guest image in public/vm (see public/vm/SOURCES.md). */
export const GUEST = {
  kernel: 'Linux 6.8.12',
  kernelUrl: '/vm/buildroot-bzimage68.bin',
  kernelSize: 10_068_480,
  memoryMB: 128,
  /** where the guest's /etc/fstab mounts the emulator's 9p share (tag host9p) */
  mount: '/mnt',
  shareDir: 'portfolio',
  // the image already runs `-/bin/sh` on ttyS0 via inittab; console=ttyS0 adds
  // kernel messages there, and the trailing console=tty0 keeps /dev/console on
  // the VGA screen so init does not start a second shell on the serial port.
  cmdline: 'tsc=reliable mitigations=off random.trust_cpu=on console=ttyS0 console=tty0',
} as const;

/** The BusyBox shell prompt on this image is `\W% `, e.g. `~% `. */
export const PROMPT_RE = /% $/;

export const README = `This is a real Linux virtual machine.
====================================

It is running right now, inside your browser tab, on your own CPU.

  kernel     Linux 6.8.12 (i686), Buildroot initramfs, BusyBox userland
  machine    an emulated x86 PC: 128 MB RAM, SeaBIOS, VGA, 16550 UART,
             virtio-net, virtio-9p
  emulator   v86 (https://github.com/copy/v86), an x86 CPU emulator and
             JIT written in Rust/JS, compiled to WebAssembly

Nothing here is simulated: the kernel you booted is the same bzImage you
could boot on bare metal, and every command runs as real i686 machine code
translated by the emulator.

This folder
-----------
/mnt is a 9p (Plan 9 filesystem protocol) share served by the emulator from
browser memory. The page wrote the portfolio documents into it after boot:

  ls -l /mnt/portfolio
  cat /mnt/portfolio/about.txt
  grep -ri python /mnt/portfolio

Anything you write to /mnt is visible to the host page; it disappears when
you close the window.

Network
-------
The VM has a virtio network card. DHCP and DNS are emulated, and HTTP on
port 80 is turned into a browser fetch() (through a small allowlisted proxy
on this site), so these work:

  wget -qO- http://example.com | head
  wget -qO- http://portfolio/api/content | head -c 400
  wget -qO- http://export.arxiv.org/api/query?search_query=all:asr | head

Other hosts are refused by the proxy; raw TCP, ping and HTTPS from inside
the guest are not available.

Try also: uname -a, cat /proc/cpuinfo, free, dmesg | head, top, lua, vi.
`;

/**
 * The files to share with the guest: ~/about.txt plus everything under
 * ~/Documents (recursively), taken from the desktop's in-memory filesystem.
 * Paths are relative to the share's portfolio folder.
 */
export function collectPortfolio(fs: FileSystem): { dirs: string[]; files: Array<[string, string]> } {
  const dirs: string[] = [];
  const files: Array<[string, string]> = [];
  const about = fs.read('/home/kali/about.txt');
  if (about !== null) files.push(['about.txt', about]);

  const walk = (node: FsNode | null, rel: string) => {
    if (!node || node.type !== 'dir' || !node.children) return;
    for (const [name, child] of Object.entries(node.children)) {
      const path = rel ? `${rel}/${name}` : name;
      if (child.type === 'dir') {
        dirs.push(path);
        walk(child, path);
      } else {
        files.push([path, child.content ?? '']);
      }
    }
  };
  walk(fs.get('/home/kali/Documents'), '');
  files.push(['README', README]);
  return { dirs, files };
}

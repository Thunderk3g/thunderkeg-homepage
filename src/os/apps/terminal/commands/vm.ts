import type { Command } from '../../../types';
import { useOS } from '../../../store';

/** `vm` boots the Virtual Machine app; qemu / virt-manager / linux are its launchCommands. */
export const vmCommands: Command[] = [
  {
    name: 'vm',
    summary: 'boot a real Linux 6.8 kernel in an x86 emulator (v86)',
    usage: 'vm [status]',
    category: 'apps',
    run: ({ args, shell }) => {
      if (args[0] === 'status') {
        const open = useOS.getState().windows.some((w) => w.appId === 'vm');
        return open ? 'vm: a Virtual Machine window is open' : 'vm: no VM running (type `vm` to boot one)';
      }
      shell.launch('vm', { autoboot: true });
      return [
        'vm: booting Linux 6.8.12 (Buildroot/BusyBox, i686, 128 MB) in v86, an x86 PC emulated in WebAssembly.',
        '    This is a real kernel, not a simulation: ~10 MB download, then a root shell on ttyS0.',
        '    Inside: ls /mnt/portfolio · wget -qO- http://example.com',
      ].join('\n');
    },
    complete: ({ args }) => ['status'].filter((s) => s.startsWith(args[0] ?? '')),
  },
];

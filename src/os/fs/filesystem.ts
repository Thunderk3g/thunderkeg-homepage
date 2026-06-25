import type { FsNode } from '../types';
import { buildHomeTree } from './tree';

/** A tiny in-memory POSIX-ish filesystem backing the terminal + file manager. */
export class FileSystem {
  root: FsNode;

  constructor(root?: FsNode) {
    this.root = root ?? { type: 'dir', children: {} };
  }

  /** Normalise a path against a cwd into an absolute, '..'-resolved path. */
  resolve(path: string, cwd = '/'): string {
    if (!path) return cwd;
    let start = path.startsWith('/') ? '/' : cwd;
    // ~ expansion
    if (path === '~' || path.startsWith('~/')) {
      start = '/home/kali';
      path = path.length > 1 ? path.slice(2) : '';
    }
    const parts = (start + '/' + path).split('/');
    const stack: string[] = [];
    for (const p of parts) {
      if (p === '' || p === '.') continue;
      if (p === '..') stack.pop();
      else stack.push(p);
    }
    return '/' + stack.join('/');
  }

  private nodeAt(abs: string): FsNode | null {
    if (abs === '/') return this.root;
    const parts = abs.split('/').filter(Boolean);
    let node: FsNode = this.root;
    for (const p of parts) {
      if (node.type !== 'dir' || !node.children || !node.children[p]) return null;
      node = node.children[p];
    }
    return node;
  }

  get(path: string, cwd = '/'): FsNode | null {
    return this.nodeAt(this.resolve(path, cwd));
  }

  exists(path: string, cwd = '/'): boolean {
    return this.get(path, cwd) !== null;
  }

  isDir(path: string, cwd = '/'): boolean {
    return this.get(path, cwd)?.type === 'dir';
  }

  list(path: string, cwd = '/'): string[] | null {
    const n = this.get(path, cwd);
    if (!n || n.type !== 'dir' || !n.children) return null;
    return Object.keys(n.children).sort();
  }

  read(path: string, cwd = '/'): string | null {
    const n = this.get(path, cwd);
    if (!n || n.type !== 'file') return null;
    return n.content ?? '';
  }

  private parent(abs: string): { dir: FsNode | null; name: string } {
    const parts = abs.split('/').filter(Boolean);
    const name = parts.pop() ?? '';
    const dirPath = '/' + parts.join('/');
    return { dir: this.nodeAt(dirPath), name };
  }

  write(path: string, content: string, cwd = '/'): boolean {
    const abs = this.resolve(path, cwd);
    const { dir, name } = this.parent(abs);
    if (!dir || dir.type !== 'dir') return false;
    dir.children = dir.children ?? {};
    const existing = dir.children[name];
    if (existing && existing.type === 'dir') return false;
    dir.children[name] = { type: 'file', content, mode: 'rw-r--r--' };
    return true;
  }

  append(path: string, content: string, cwd = '/'): boolean {
    const prev = this.read(path, cwd) ?? '';
    return this.write(path, prev + content, cwd);
  }

  mkdir(path: string, cwd = '/'): boolean {
    const abs = this.resolve(path, cwd);
    const { dir, name } = this.parent(abs);
    if (!dir || dir.type !== 'dir' || !name) return false;
    dir.children = dir.children ?? {};
    if (dir.children[name]) return false;
    dir.children[name] = { type: 'dir', children: {}, mode: 'rwxr-xr-x' };
    return true;
  }

  touch(path: string, cwd = '/'): boolean {
    if (this.exists(path, cwd)) return true;
    return this.write(path, '', cwd);
  }

  remove(path: string, cwd = '/'): boolean {
    const abs = this.resolve(path, cwd);
    if (abs === '/' || abs === '/home/kali') return false;
    const { dir, name } = this.parent(abs);
    if (!dir || dir.type !== 'dir' || !dir.children || !dir.children[name]) return false;
    delete dir.children[name];
    return true;
  }
}

export function createDefaultFileSystem(): FileSystem {
  return new FileSystem({
    type: 'dir',
    children: {
      home: { type: 'dir', children: { kali: buildHomeTree() } },
      etc: {
        type: 'dir',
        children: {
          'os-release': {
            type: 'file',
            content:
              'PRETTY_NAME="Kali GNU/Linux Rolling"\nNAME="Kali GNU/Linux"\nID=kali\nVERSION="2025.2"\nVERSION_ID="2025.2"\nID_LIKE=debian\nHOME_URL="https://www.kali.org/"\n',
          },
          hostname: { type: 'file', content: 'kali\n' },
          passwd: {
            type: 'file',
            content:
              'root:x:0:0:root:/root:/usr/bin/zsh\nkali:x:1000:1000:Diwakar Adhikari,,,:/home/kali:/usr/bin/zsh\n',
          },
          shells: { type: 'file', content: '/bin/sh\n/bin/bash\n/usr/bin/zsh\n' },
        },
      },
      usr: {
        type: 'dir',
        children: {
          share: { type: 'dir', children: {} },
          bin: { type: 'dir', children: {} },
        },
      },
      var: { type: 'dir', children: { log: { type: 'dir', children: {} } } },
      tmp: { type: 'dir', children: {} },
      root: { type: 'dir', children: {} },
      bin: { type: 'dir', children: {} },
      opt: { type: 'dir', children: {} },
    },
  });
}

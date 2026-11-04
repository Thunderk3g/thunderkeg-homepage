// Copies the v86 WebAssembly cores and its ESM loader (libv86.mjs) from
// node_modules into public/vm, where the Virtual Machine app loads them at
// runtime (/vm/*.wasm, /vm/libv86.mjs). They are build artefacts of the pinned
// v86 package and are not committed (see .gitignore).
// Runs on postinstall and prebuild; never fails the install if v86 is absent.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'v86', 'build');
const dest = join(root, 'public', 'vm');
const files = ['v86.wasm', 'v86-fallback.wasm', 'libv86.mjs'];

if (!existsSync(src)) {
  console.warn('[copy-vm-assets] node_modules/v86 not found; skipping (the VM app will not boot)');
  process.exit(0);
}

try {
  mkdirSync(dest, { recursive: true });
  const copied = [];
  for (const f of files) {
    const from = join(src, f);
    if (!existsSync(from)) {
      console.warn(`[copy-vm-assets] ${f} missing from the v86 build; skipping it`);
      continue;
    }
    copyFileSync(from, join(dest, f));
    copied.push(f);
  }
  console.log(`[copy-vm-assets] copied ${copied.join(', ') || 'nothing'} to public/vm`);
} catch (err) {
  console.warn('[copy-vm-assets] failed:', err instanceof Error ? err.message : err);
}

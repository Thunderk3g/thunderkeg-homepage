import type { ReactNode } from 'react';

/* A small, consistent set of inline SVG mime icons drawn in a Breeze-ish flat
   style. No emoji. Colours come from fills so themes still read them clearly. */

type IconProps = { size?: number };

const wrap = (size: number, children: ReactNode): ReactNode => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="kos-dolphin-svg">
    {children}
  </svg>
);

export function FolderIcon({ size = 32 }: IconProps) {
  return wrap(
    size,
    <>
      <path d="M5 13a3 3 0 0 1 3-3h10l4 4h17a3 3 0 0 1 3 3v3H5z" fill="#5c6b82" />
      <path d="M5 18h40v18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#6f84a3" />
      <path d="M5 18h40v4H5z" fill="#7d93b4" opacity="0.6" />
    </>,
  );
}

function sheet(children: ReactNode) {
  return (
    <>
      <path d="M12 4h17l9 9v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#eceff4" />
      <path d="M29 4l9 9h-7a2 2 0 0 1-2-2z" fill="#c3cad6" />
      {children}
    </>
  );
}

export function MarkdownIcon({ size = 32 }: IconProps) {
  return wrap(
    size,
    sheet(
      <>
        <rect x="15" y="22" width="18" height="12" rx="1.5" fill="none" stroke="#2777ff" strokeWidth="2" />
        <path d="M18 31v-6l3 3 3-3v6M28 25v6M28 31l2-2M28 31l-2-2" fill="none" stroke="#2777ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>,
    ),
  );
}

export function TextIcon({ size = 32 }: IconProps) {
  return wrap(
    size,
    sheet(
      <>
        <path d="M15 21h18M15 26h18M15 31h12" stroke="#7a8699" strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
  );
}

export function CodeIcon({ size = 32 }: IconProps) {
  return wrap(
    size,
    sheet(
      <>
        <path d="M21 23l-5 5 5 5M27 23l5 5-5 5" fill="none" stroke="#45b97c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </>,
    ),
  );
}

export function ConfigIcon({ size = 32 }: IconProps) {
  return wrap(
    size,
    sheet(
      <>
        <circle cx="24" cy="29" r="4" fill="none" stroke="#c98b2e" strokeWidth="2" />
        <path d="M24 22v2M24 34v2M31 29h-2M19 29h-2M29 24l-1.4 1.4M20.4 32.6L19 34M29 34l-1.4-1.4M20.4 25.4L19 24" stroke="#c98b2e" strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
  );
}

export function ImageIcon({ size = 32 }: IconProps) {
  return wrap(
    size,
    sheet(
      <>
        <rect x="15" y="21" width="18" height="13" rx="1.5" fill="#d7ecff" stroke="#2777ff" strokeWidth="1.6" />
        <circle cx="19.5" cy="25.5" r="1.8" fill="#f5c451" />
        <path d="M15 32l5-5 4 4 4-5 5 6" fill="none" stroke="#2777ff" strokeWidth="1.8" strokeLinejoin="round" />
      </>,
    ),
  );
}

export function GenericIcon({ size = 32 }: IconProps) {
  return wrap(size, sheet(null));
}

export type FileKind = 'dir' | 'markdown' | 'text' | 'code' | 'config' | 'image' | 'generic';

export function kindOf(name: string, isDir: boolean): FileKind {
  if (isDir) return 'dir';
  const lower = name.toLowerCase();
  if (name.startsWith('.')) return 'config';
  if (/\.(md|markdown)$/.test(lower)) return 'markdown';
  if (/\.(txt|log|csv)$/.test(lower)) return 'text';
  if (/\.(ts|tsx|js|jsx|mjs|cjs|json|css|html|sh|py|rs|go|c|cpp|h)$/.test(lower)) return 'code';
  if (/\.(ya?ml|toml|ini|conf|cfg|env|zshrc|bashrc)$/.test(lower)) return 'config';
  if (/\.(png|jpe?g|gif|svg|webp|bmp)$/.test(lower)) return 'image';
  return 'generic';
}

export function FileIcon({ name, isDir, size = 32 }: { name: string; isDir: boolean; size?: number }) {
  switch (kindOf(name, isDir)) {
    case 'dir':
      return <FolderIcon size={size} />;
    case 'markdown':
      return <MarkdownIcon size={size} />;
    case 'text':
      return <TextIcon size={size} />;
    case 'code':
      return <CodeIcon size={size} />;
    case 'config':
      return <ConfigIcon size={size} />;
    case 'image':
      return <ImageIcon size={size} />;
    default:
      return <GenericIcon size={size} />;
  }
}

export function kindLabel(name: string, isDir: boolean): string {
  switch (kindOf(name, isDir)) {
    case 'dir':
      return 'Folder';
    case 'markdown':
      return 'Markdown document';
    case 'text':
      return 'Plain text document';
    case 'code':
      return 'Source code';
    case 'config':
      return 'Configuration file';
    case 'image':
      return 'Image';
    default:
      return 'File';
  }
}

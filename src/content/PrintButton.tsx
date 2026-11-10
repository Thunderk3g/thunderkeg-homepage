'use client';

export function PrintButton({ children }: { children: React.ReactNode }) {
  return (
    <button type="button" className="man-btn" onClick={() => window.print()}>
      {children}
    </button>
  );
}

# Cmd+K Command Palette — Integration notes for main agent

## What this ships

- `src/components/apps/command-palette/CommandPalette.tsx` — the dialog UI
- `src/lib/cmdk/useGlobalHotkey.ts` — generic hotkey hook
- `src/lib/cmdk/CommandPaletteProvider.tsx` — top-level provider
- `src/lib/cmdk/index.ts` — barrel: `{ CommandPalette, CommandPaletteProvider, useGlobalHotkey }`

No registry entry is needed. Cmd+K is global, not a windowed app.

## Where to wrap in `src/components/desktop/Desktop.tsx`

`CommandPaletteProvider` must sit **inside** `WindowManagerProvider`
(`CommandPalette` calls `useWindows()` to open apps).

```tsx
import { CommandPaletteProvider } from "@/lib/cmdk";

export function Desktop() {
  return (
    <WindowManagerProvider>
      <CommandPaletteProvider>
        <DesktopBody />
      </CommandPaletteProvider>
    </WindowManagerProvider>
  );
}
```

`DesktopBody` itself doesn't need changes — the provider renders its
`<CommandPalette />` as a sibling and only shows it on Cmd/Ctrl+K.

## Optional taskbar button

A "search" button on the taskbar that calls a public toggler would be nice.
Currently the provider has no imperative API — if you need one, lift the
`open` state higher and expose a context. Out of scope for PR α #1.

## Toast dependency (sonner)

The palette calls `toast.message(...)` from `sonner` for file/slash actions.
Without a `<Toaster />` mounted somewhere in the tree these calls are no-ops
(they don't throw). The parallel "Notification toasts" agent (PR α #5) is
expected to mount the `<Toaster />`. Until then the palette still works —
selections just take effect silently.

## Resume tab focus

`runResume` writes the desired tab key (`"summary" | "experience" | "projects"`)
to `localStorage["thunderkeg.resume.tab"]` before opening the Resume app.
`ResumeApp` does not yet read this — a follow-up patch in the Resume territory
can pick it up in a `useEffect`:

```tsx
useEffect(() => {
  const t = window.localStorage.getItem("thunderkeg.resume.tab");
  if (t === "summary" || t === "experience" || t === "projects") {
    setActiveTab(t);
    window.localStorage.removeItem("thunderkeg.resume.tab");
  }
}, []);
```

## Behaviours summary

- **Cmd/Ctrl + K** anywhere on the page → toggle palette open/closed
- **Esc** → close (Radix Dialog default)
- **↑ / ↓** → navigate items, looped
- **Enter** → select highlighted item
- **Type** → fuzzy filter across all groups (cmdk's `command-score` filter)
- Empty results show: `No results. Try 'about' or 'compliance'.`

## Sections

1. **Apps** — all 10 `AppKind`s → `useWindows().open(kind)`
2. **Files** — flattened fake `~/` FS (mirrored from `terminal/shell.ts`).
   Selecting an "app" entry opens the linked app + toasts;
   selecting a regular file shows its first lines in a toast.
3. **Slash commands** — `/help /clear /resume /projects /voice /contact`.
   Opens Terminal + toasts asking the user to type the slash command.
4. **Resume** — indexes `summary` + each experience bullet + each project blurb.
   Opens Resume app, hinted to the relevant tab via `localStorage`.

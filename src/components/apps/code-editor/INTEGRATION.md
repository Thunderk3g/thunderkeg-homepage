# Code Editor — integration checklist (for the main agent)

The Code Editor app lives entirely inside `src/components/apps/code-editor/`. To
wire it into the Kali-desktop shell, the main agent must touch a few shared
files. **None** of these edits were performed by the feature agent.

## 1. Register the AppKind

`src/types/window.ts`

```ts
export type AppKind =
  | "terminal" | "voice" | "resume" | "projects"
  | "about"    | "social" | "doom"   | "tetris"
  | "mp3"      | "vlc"    | "code-editor";
```

## 2. Add to the app registry

`src/components/apps/registry.tsx`

```ts
import CodeEditorApp from "./code-editor/CodeEditorApp";

export const APP_REGISTRY: Record<AppKind, React.ComponentType> = {
  // …existing entries…
  "code-editor": CodeEditorApp,
};
```

## 3. Default window title

`src/components/desktop/WindowManager.tsx` — extend `DEFAULT_TITLES`:

```ts
export const DEFAULT_TITLES: Record<AppKind, string> = {
  // …existing entries…
  "code-editor": "Code Editor",
};
```

## 4. Desktop icon + Start Menu

Use the `FileCode` icon from `lucide-react` for both the desktop shortcut and
the Start Menu entry. Suggested label: `Code Editor`. Default window size of
`960×640` reads more comfortably than the `720×480` default — pass via
`open("code-editor", { bounds: { width: 960, height: 640 } })` if desired.

## 5. Optional: terminal opener

If you want `cat ~/README.md` or similar to open the editor instead of
printing, add a mapping in `src/components/apps/terminal/shell.ts`. Not
required for v1 — the editor stands alone.

## Notes

- The app fetches `/resume.json` once and caches it at the module level. It
  does **not** import from `terminal/shell.ts`.
- All styling uses the design tokens (`bg-surface`, `bg-elevated`,
  `border-border`, `text-accent`, `text-fg`, `text-muted`). No raw hex values.
- CodeMirror is configured with `theme="dark"` and `editable={false}` /
  `readOnly`. Cmd/Ctrl+S triggers a `Blob` download of the active buffer.

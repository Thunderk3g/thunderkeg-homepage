# File Manager — Integration TODOs

Self-contained app under `src/components/apps/files/`. Five edits required in
shared files to wire it into the desktop. None of these were performed by the
build agent (out-of-scope for the worktree).

## 1. `src/types/window.ts`

Add `"files"` to the `AppKind` union:

```ts
export type AppKind =
  | "terminal" | "voice" | "resume" | "projects"
  | "about"    | "social" | "doom"   | "tetris" | "mp3" | "vlc"
  | "files";
```

## 2. `src/components/apps/registry.tsx`

Import and register the component:

```tsx
import FileManagerApp from "./files/FileManagerApp";

export const APP_REGISTRY: Record<AppKind, React.ComponentType> = {
  // …existing entries…
  files: FileManagerApp,
};
```

## 3. `src/components/desktop/WindowManager.tsx`

Add a default title inside `DEFAULT_TITLES`:

```ts
export const DEFAULT_TITLES: Record<AppKind, string> = {
  // …existing entries…
  files: "Files",
};
```

## 4. `src/components/desktop/DesktopIcons.tsx`

Add a desktop icon using the lucide `Folder` icon, label "Files", that opens
the `"files"` app via `useWindows().open("files")`. Match the existing icon
pattern in that file.

## 5. `src/components/desktop/StartMenu.tsx`

Add a Start Menu entry for "Files" (lucide `Folder` icon) that calls
`useWindows().open("files")`.

## Notes

- The File Manager re-implements the Terminal's `buildFs(resume)` inline
  (`./fs.ts`) so the two apps don't share modules across sibling app folders.
  If the FS shape changes in `terminal/shell.ts`, update `files/fs.ts` to
  match.
- Inline `.txt` preview shows up to 400 chars. `.json` and other files
  currently `alert("Open in Code Editor (coming soon)")` — wire this to the
  forthcoming Code Editor app when it lands.
- App-link entries (`games/doom`, `games/tetris`, `media/mp3`, `media/vlc`,
  `resume.json`) already call `open(node.app)`. No additional plumbing needed
  once the AppKind union includes `"files"`.

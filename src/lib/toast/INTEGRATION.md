# Toast — Integration Notes (for the main wiring agent)

This module is self-contained inside `src/lib/toast/`. The main agent does
the one-time wiring described below; nothing else in the tree needs to know
about toasts beyond importing `toast` from `@/lib/toast`.

## 1. Mount `<Toaster />` once

Render `<Toaster />` exactly once at the top of `Desktop.tsx`'s `DesktopBody`,
**after** the windows `.map(...)` and **before** the `<Taskbar />`. That
ordering puts the toast layer above every window but below nothing the user
needs to click through.

```tsx
// src/components/desktop/Desktop.tsx (DesktopBody)
import { Toaster } from "@/lib/toast";

// …inside DesktopBody's return:
return (
  <>
    {/* windows */}
    {openWindows.map((w) => <WindowFrame key={w.id} {...w} />)}

    {/* toast layer — overlays windows, sits under the taskbar visually
        only because the taskbar has its own higher z-index */}
    <Toaster />

    <Taskbar />
  </>
);
```

No provider, no context, no store wiring. Sonner ships its own internal
state; mounting `<Toaster />` is the entire setup.

## 2. Firing toasts from anywhere

Any client component (or any module loaded by one) can do:

```ts
import { toast } from "@/lib/toast";

toast.success("Theme set to Tokyo Night");
toast.error("Agent offline", { description: "LLM_API_KEY not set" });
toast.message("Terminal cleared");
```

See `sample-uses.md` for the canonical patterns.

## 3. What this module deliberately does NOT do

- It does not export a `<ToastProvider>` — sonner doesn't use React context.
- It does not wrap `toast` in a custom function — callers should use the
  full sonner API surface (`toast.success`, `toast.error`, `toast.message`,
  `toast.promise`, `toast.dismiss`, etc.) directly.
- It does not include the default sonner stylesheet. All visuals come from
  Tailwind classes inside `Toaster.tsx`, which already match the Kali theme
  tokens (`bg-elevated`, `text-fg`, `border-border`, `shadow-window`, etc.).

## 4. Theme tokens required

`Toaster.tsx` assumes these Tailwind tokens exist (they're part of the Kali
theme work in PR α):

- `bg-elevated`, `bg-surface`, `bg-accent`
- `text-fg`, `text-muted`, `text-bg`
- `border-border`, `border-success`, `border-danger`, `border-warning`
- `shadow-window`

If a token is missing the class is simply ignored — the toast still renders,
just unstyled. No runtime error.

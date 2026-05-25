# Toast — Sample Uses

Import once, fire anywhere:

```ts
import { toast } from "@/lib/toast";
```

`<Toaster />` is mounted in `Desktop.tsx` (see `INTEGRATION.md`). No provider,
no context — sonner manages its own queue.

## Patterns the rest of the codebase should adopt

### 1. Theme change (settings / palette switcher)

```ts
toast.success("Theme set to Tokyo Night");
```

Use `toast.success` whenever a user-initiated state change completes cleanly.

### 2. Terminal `/clear` command

```ts
toast.message("Terminal cleared");
```

Use `toast.message` for neutral confirmations that aren't really success/error
— they're just feedback that an action was registered.

### 3. Agent API returns 503 / missing key

```ts
toast.error("Agent offline", {
  description: "LLM_API_KEY not set",
});
```

Use `toast.error` for failures the user can act on. The `description` slot
carries the technical detail; the title stays human.

### 4. File Manager — open a project folder

```ts
toast.message("Opened ~/projects/compliance-agent");
```

Lightweight breadcrumb for navigation events.

### 5. Long-running task with cancel

```ts
toast.message("Building resume.pdf…", {
  description: "This may take a few seconds.",
  cancel: {
    label: "Cancel",
    onClick: () => abortBuild(),
  },
});
```

Use `cancel` (and optionally `action`) for toasts that wrap an in-flight job.

## Conventions

- Titles are short, sentence-case, no trailing punctuation.
- Put error codes / paths / variable names in `description`, never the title.
- Prefer `toast.message` over `toast.info` for neutral confirmations — it
  reads less alarming and matches the terminal-style UI.
- Don't fire a toast for every state change; reserve them for actions the
  user just took or background events they couldn't otherwise observe.

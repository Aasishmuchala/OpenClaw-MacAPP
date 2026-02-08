# Sidebar Navigation Refactor (Option B)

Date: 2026-02-08

## Goal

Refactor OpenClaw Desktop (Tauri + React) UI/navigation to follow Web Interface Guidelines and feel like a modern mac desktop control panel.

User choice: **Option B** — left sidebar contains Profiles + Chats + Sections; main area renders selected section.

## IA / Navigation

### Sidebar

1. Brand header
2. Active profile control (list/switch)
3. Primary sections nav:
   - Chats
   - Gateway
   - Models
   - Permissions
   - Settings
4. Contextual sidebar content:
   - If **Chats** selected: chat list + create
   - Else: compact quick actions for the selected section (optional, can be phase 2)

### Main area

Render the selected section page:

- Chats: thread + composer + per-chat controls
- Gateway: status + actions + logs
- Models: status + set default model
- Permissions: guided permissions links
- Settings: OpenClaw CLI path override + OpenClaw profile info

## State model

Introduce route state:

```ts
type Section = "chats" | "gateway" | "models" | "permissions" | "settings";
```

- `section: Section`
- `activeChatId: string | null` meaningful only when `section === "chats"`

## Guidelines compliance targets

- Visible focus states via `:focus-visible`.
- Labels for form fields (`label` or `aria-label`), avoid placeholder-only.
- Buttons for actions; no div-click.
- Hover/active/focus states.
- Avoid `outline: none` unless focus replacement exists.

## Folder/Component refactor (target)

- `src/components/` for reusable UI
- `src/panels/` for section panels
- `src/styles/` for CSS
- Keep `src/lib/` for Tauri invoke wrappers

## Success criteria

- Navigation is clear, single source of truth.
- Chats remain functional with no regressions.
- `npm run build` and `cargo check` stay green.

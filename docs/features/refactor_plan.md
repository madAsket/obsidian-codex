# Refactor plan

## Goals
- Remove hardcoded values and centralize configuration.
- Split the current React monolith into smaller components and hooks.
- Remove legacy logic and related constants.
- Improve separation of concerns (SOLID) across UI, services, and storage.

## Constraints
- Do not change UX or visual styles.
- Keep project naming as "Redstone" / "Redstone Copilot".

## Scope overview
- UI: `src/ui/ChatApp.tsx` (large, multi-responsibility).
- Services: `src/services/codex-service.ts`, `src/utils/codex-download.ts`, `src/utils/codex-path.ts`.
- Storage: `src/data/data-store.ts`.
- Constants: `src/constants.ts`.
- Bootstrap/auth flows: `src/ui/ChatApp.tsx`, `src/services/codex-service.ts`.
- Legacy: `LEGACY_AGENTS_CONTENT` handling in `src/constants.ts` and `src/main.ts`.

## Proposed refactor (what/where)

### 1) Hardcoded values → config module
- Move CLI release tag, asset mapping, and install URLs into a single config file.
- Extract UI copy strings into a `copy.ts` module for reuse and clarity.
- Extract size/limits (e.g., `MAX_MESSAGES`) into a centralized config with comments.
- Add a typed "platform map" for download assets and supported OS/arch.

Files:
- `src/constants.ts`
- `src/utils/codex-download.ts`
- `src/ui/ChatApp.tsx`

### 2) Split React into components + hooks
Target components to extract from `src/ui/ChatApp.tsx`:
- `ChatHeader` (title, indicator, chat select, settings button, token summary)
- `BootstrapPanel` (binary selection/download/manual check)
- `AuthPanel` (login actions + terminal instructions)
- `InstallPanel` (Codex missing)
- `ErrorPanel` (unexpected error)
- `Transcript` (messages list + scrolling)
- `InputArea` (textarea + send/stop button)
- `Toolbox` (model/reasoning selectors + context selector)

Hooks to extract:
- `useCodexAuth` (auth status + login flow)
- `useCodexBootstrap` (candidate detection + download + selection)
- `useChatState` (messages, streaming, usage)
- `useChatPersistence` (save/load + threadId)

Files:
- `src/ui/ChatApp.tsx` → split to `src/ui/components/*` and `src/ui/hooks/*`.

### 3) SOLID separation
- Introduce a `CodexClient` interface to decouple SDK usage from UI.
- Move login flow + status checks into a dedicated `AuthService`.
- Split `DataStore` into `ChatRepository` (messages/meta) + `SettingsStore` (settings).
- Keep `CodexService` focused on running threads (no UI state).

Files:
- `src/services/codex-service.ts`
- `src/services` (new: `auth-service.ts`)
- `src/data/data-store.ts`

### 4) Remove legacy logic
- Remove `LEGACY_AGENTS_CONTENT` constant.
- Remove legacy AGENTS rewrite logic in `src/main.ts`.
- Keep only the current `AGENTS_CONTENT` creation path.

Files:
- `src/constants.ts`
- `src/main.ts`

### 5) Minor cleanup
- Fix typos like "Model Setttings" -> "Model Settings".
- Normalize naming (e.g., "Redstone" vs "Codex" in header).
- Consolidate duplicated status messages into one place.

Files:
- `src/settings.ts`
- `src/ui/ChatApp.tsx`
- `src/constants.ts`

## Tasks (iteration order)
1) Extract UI components and hooks, keep behavior identical.
2) Centralize config and copy strings.
3) Split services (Auth/CLI/Download) and define interfaces.
4) Split storage into chat + settings stores.
5) Remove legacy AGENTS logic.
6) Cleanup naming, copy, and minor typos.

## Notes / risks
- Be careful not to break multi-chat persistence or threadId resume.
- Keep bootstrap/auth flows in sync after splitting files.
- Update imports and ensure settings updates still refresh the service.

# Lint tasks (npm run lint)

Run output captured from `npm run lint` on 2025-12-26.

## Commands

- `src/commands/index.ts`: remove plugin name from command title and use sentence case.
  - obsidianmd/commands/no-plugin-name-in-command-name
  - obsidianmd/ui/sentence-case

## Data store

- `src/data/data-store.ts`: fix unsafe assignment (any). (Line 126)
  - @typescript-eslint/no-unsafe-assignment

## Main

- `src/main.ts`: sentence case for ribbon tooltip (line 25), and await/void the `toggleSidebar` call (line 53).
  - obsidianmd/ui/sentence-case
  - @typescript-eslint/no-floating-promises

## Codex service

- `src/services/codex-service.ts`: remove unused `error` variable (line 164).
  - @typescript-eslint/no-unused-vars
- `src/services/codex-service.ts`: define `Buffer` (line 227).
  - no-undef

## Settings UI

- `src/settings.ts`: avoid "settings" in heading (line 118).
  - obsidianmd/settings-tab/no-problematic-settings-headings
- `src/settings.ts`: sentence case UI text for labels/descriptions (lines 177, 209, 226).
  - obsidianmd/ui/sentence-case

## Chat UI (ChatApp)

- `src/ui/ChatApp.tsx`: replace `JSX.Element` with `React.JSX.Element` (line 94).
  - @typescript-eslint/no-deprecated
  - no-undef
- `src/ui/ChatApp.tsx`: await or void a promise (line 223).
  - @typescript-eslint/no-floating-promises
- `src/ui/ChatApp.tsx`: throw `Error` objects only (line 403).
  - @typescript-eslint/only-throw-error
- `src/ui/ChatApp.tsx`: fix async handlers in JSX props (lines 753–780).
  - @typescript-eslint/no-misused-promises

## UI components

- `src/ui/components/*.tsx`: replace `JSX.Element` with `React.JSX.Element`.
  - @typescript-eslint/no-deprecated
  - no-undef

## Codex download utils

- `src/utils/codex-download.ts`: add proper `process`/`Buffer` typing (lines 15, 18, 19, 84, 145, 156, 175).
  - no-undef
- `src/utils/codex-download.ts`: remove unused `error` variable (line 161).
  - @typescript-eslint/no-unused-vars

## Codex path utils

- `src/utils/codex-path.ts`: add proper `process` typing (lines 6, 51, 63, 77, 78, 142, 152).
  - no-undef
- `src/utils/codex-path.ts`: remove unused `error` variable (line 71).
  - @typescript-eslint/no-unused-vars


# Plugin guidelines check

Source: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines

## Fixed for compliance

- Removed debug `console.log` output in `src/ui/ChatApp.tsx`.
- `src/main.ts`: removed `detachLeavesOfType` from `onunload()`.
- `src/settings.ts`: replaced HTML headings with `Setting(...).setHeading()` and fixed heading copy to sentence case.
- `src/commands/index.ts`: command name switched to sentence case.
- `styles.css`: removed forced uppercase transforms in UI labels.

## Remaining / confirm

- `src/data/data-store.ts`: uses `app.vault.adapter` for chat files under `.obsidian/plugins/...`. Guidelines prefer the Vault API; confirm whether adapter use is acceptable for `.obsidian` storage or switch to Vault where possible.

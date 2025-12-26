# Codex CLI bootstrap flow

## Agreements
- When no Codex binary is selected on first launch, show a dedicated sidebar panel.
- The panel includes three stacked options:
  - Select from detected system binaries (if any) + Save button.
  - Download the Codex binary into the plugin directory (v0.7.7 - https://github.com/openai/codex/releases/tag/rust-v0.77.0).
  - Manual install instructions with a "Check" button.
- Option A: save the selected binary and check login.
- Option B: download the OS/arch binary, save it as selected, then check login.
- If not logged in after selection, show login state with:
  - Button to authorize in browser.
  - Terminal login instructions + Check button.
- Option C: wait for the user to press "Check", detect system install, save it, then check login.

## Tasks
- Detect the "no selected binary" state and render the bootstrap panel instead of chat.
- List candidate binaries from system detection in a select control.
- Add a download action that picks the correct OS/arch asset and validates it.
- Add manual install copy + Check button that re-runs detection.
- After any selection, run login status check and update the UI state.

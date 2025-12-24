import type CodexPlugin from "../main";

export function registerCommands(plugin: CodexPlugin): void {
  plugin.addCommand({
    id: "codex-toggle-sidebar",
    name: "Codex: Toggle sidebar",
    callback: () => plugin.toggleSidebar(),
  });
}

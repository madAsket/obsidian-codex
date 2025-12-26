import type CodexPlugin from "../main";

export function registerCommands(plugin: CodexPlugin): void {
  plugin.addCommand({
    id: "redstone-toggle-sidebar",
    name: "Toggle copilot",
    callback: () => plugin.toggleSidebar(),
  });
}

import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import {
  AGENTS_CONTENT,
  AGENTS_FILE,
  LEGACY_AGENTS_CONTENT,
  VIEW_TYPE,
} from "./constants";
import { registerCommands } from "./commands";
import { DataStore } from "./data/data-store";
import { CodexSettingsTab } from "./settings";
import { CodexView } from "./ui/CodexView";

export default class CodexPlugin extends Plugin {
  dataStore!: DataStore;

  async onload(): Promise<void> {
    this.dataStore = new DataStore(this);
    await this.dataStore.load(this.app.vault.getName());

    await this.ensureAgentsFile();

    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) =>
      new CodexView(leaf, this)
    );

    this.addRibbonIcon("message-circle-code", "Codex: Toggle sidebar", () => {
      void this.toggleSidebar();
    });

    this.addSettingTab(
      new CodexSettingsTab(this.app, this, {
        getSettings: () => this.dataStore.getSettings(),
        updateSettings: (settings) => this.dataStore.setSettings(settings),
        saveSettings: () => this.dataStore.save(),
      })
    );

    registerCommands(this);
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async toggleSidebar(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existingLeaves.length > 0) {
      existingLeaves.forEach((leaf) => leaf.detach());
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      return;
    }

    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  private async ensureAgentsFile(): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(AGENTS_FILE);
    if (existing) {
      if (existing instanceof TFile) {
        try {
          const content = await this.app.vault.read(existing);
          if (content === LEGACY_AGENTS_CONTENT) {
            await this.app.vault.modify(existing, AGENTS_CONTENT);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn("Codex: failed to update AGENTS.md", message);
        }
      }
      return;
    }

    try {
      await this.app.vault.create(AGENTS_FILE, AGENTS_CONTENT);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Codex: failed to create AGENTS.md", message);
    }
  }
}

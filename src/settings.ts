import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { CodexModel, CodexReasoning, CodexSettings } from "./types";

export const MODEL_OPTIONS = ["gpt-5.2-codex", "gpt-5.2"] as const;
export const REASONING_OPTIONS = [
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export const DEFAULT_SETTINGS: CodexSettings = {
  model: "gpt-5.2",
  reasoning: "low",
  internetAccess: false,
  webSearch: false,
};

export function isModelOption(value: unknown): value is CodexModel {
  return MODEL_OPTIONS.includes(value as CodexModel);
}

export function isReasoningOption(value: unknown): value is CodexReasoning {
  return REASONING_OPTIONS.includes(value as CodexReasoning);
}

export function normalizeSettings(
  raw: Partial<CodexSettings> | null | undefined
): CodexSettings {
  const model = isModelOption(raw?.model) ? raw?.model : DEFAULT_SETTINGS.model;
  const reasoning = isReasoningOption(raw?.reasoning)
    ? raw?.reasoning
    : DEFAULT_SETTINGS.reasoning;
  const internetAccess =
    typeof raw?.internetAccess === "boolean"
      ? raw.internetAccess
      : DEFAULT_SETTINGS.internetAccess;
  const webSearch =
    typeof raw?.webSearch === "boolean"
      ? raw.webSearch
      : DEFAULT_SETTINGS.webSearch;

  return {
    model,
    reasoning,
    internetAccess,
    webSearch: internetAccess ? webSearch : false,
  };
}

type SettingsAccess = {
  getSettings: () => CodexSettings;
  updateSettings: (settings: CodexSettings) => void;
  saveSettings: () => Promise<void>;
};

export class CodexSettingsTab extends PluginSettingTab {
  private access: SettingsAccess;

  constructor(app: App, plugin: Plugin, access: SettingsAccess) {
    super(app, plugin);
    this.access = access;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const settings = this.access.getSettings();

    containerEl.createEl("h3", { text: "Model Setttings" });

    new Setting(containerEl).setName("Model").addDropdown((dropdown) => {
      for (const option of MODEL_OPTIONS) {
        dropdown.addOption(option, option);
      }
      dropdown.setValue(settings.model);
      dropdown.onChange(async (value) => {
        const next = normalizeSettings({
          ...this.access.getSettings(),
          model: value as CodexModel,
        });
        this.access.updateSettings(next);
        await this.access.saveSettings();
      });
    });

    new Setting(containerEl).setName("Reasoning").addDropdown((dropdown) => {
      for (const option of REASONING_OPTIONS) {
        dropdown.addOption(option, option);
      }
      dropdown.setValue(settings.reasoning);
      dropdown.onChange(async (value) => {
        const next = normalizeSettings({
          ...this.access.getSettings(),
          reasoning: value as CodexReasoning,
        });
        this.access.updateSettings(next);
        await this.access.saveSettings();
      });
    });

    containerEl.createEl("h3", { text: "Advanced" });

    new Setting(containerEl)
      .setName("Internet access")
      .setDesc(
        "Enables network access for Codex. This may send data to external services."
      )
      .addToggle((toggle) => {
        toggle.setValue(settings.internetAccess);
        toggle.onChange(async (value) => {
          const next = normalizeSettings({
            ...this.access.getSettings(),
            internetAccess: value,
          });
          this.access.updateSettings(next);
          await this.access.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Web search requests")
      .setDesc("Allow Codex to request web searches. Requires Internet access.")
      .addToggle((toggle) => {
        toggle.setValue(settings.webSearch);
        toggle.setDisabled(!settings.internetAccess);
        toggle.onChange(async (value) => {
          const next = normalizeSettings({
            ...this.access.getSettings(),
            webSearch: value,
          });
          this.access.updateSettings(next);
          await this.access.saveSettings();
        });
      });
  }
}

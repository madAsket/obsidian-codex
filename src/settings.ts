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
  return { model, reasoning };
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
  }
}

import path from "path";
import {
  App,
  FileSystemAdapter,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
import type {
  CodexModel,
  CodexPathMode,
  CodexReasoning,
  CodexSettings,
} from "./types";
import { getCodexCandidates } from "./utils/codex-path";

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
  codexPathMode: "unset",
  codexPath: null,
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
  const codexPath =
    typeof raw?.codexPath === "string" && raw.codexPath.trim().length > 0
      ? raw.codexPath.trim()
      : null;
  const codexPathMode =
    raw?.codexPathMode === "unset" ||
    raw?.codexPathMode === "auto" ||
    raw?.codexPathMode === "custom"
      ? raw.codexPathMode
      : null;
  let normalizedMode =
    codexPathMode ?? (codexPath ? "custom" : DEFAULT_SETTINGS.codexPathMode);
  if (normalizedMode === "custom" && !codexPath) {
    normalizedMode = "unset";
  }
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
    codexPathMode: normalizedMode,
    codexPath: normalizedMode === "custom" ? codexPath : null,
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
  private plugin: Plugin;

  constructor(app: App, plugin: Plugin, access: SettingsAccess) {
    super(app, plugin);
    this.access = access;
    this.plugin = plugin;
  }

  private getPluginRoot(): string | null {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      return null;
    }
    const basePath = adapter.getBasePath();
    const pluginDir = this.plugin.manifest.dir;
    if (!pluginDir) {
      return null;
    }
    return path.normalize(path.join(basePath, pluginDir));
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

    const codexCandidates = getCodexCandidates(this.getPluginRoot());
    const codexOptions = [
      { value: "unset", label: "Not selected (use sidebar setup)" },
      { value: "auto", label: "Auto (system PATH)" },
      ...codexCandidates.map((candidate) => ({
        value: candidate.path,
        label: candidate.label,
      })),
    ];
    if (
      settings.codexPathMode === "custom" &&
      settings.codexPath &&
      !codexCandidates.some((candidate) => candidate.path === settings.codexPath)
    ) {
      codexOptions.push({
        value: settings.codexPath,
        label: `Custom: ${settings.codexPath}`,
      });
    }

    const currentCodexValue =
      settings.codexPathMode === "custom" && settings.codexPath
        ? settings.codexPath
        : settings.codexPathMode;

    new Setting(containerEl)
      .setName("Codex CLI")
      .setDesc("Select which Codex executable to use.")
      .addDropdown((dropdown) => {
        for (const option of codexOptions) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown.setValue(currentCodexValue);
        dropdown.onChange(async (value) => {
          let mode: CodexPathMode = "custom";
          let nextPath: string | null = value;
          if (value === "unset") {
            mode = "unset";
            nextPath = null;
          } else if (value === "auto") {
            mode = "auto";
            nextPath = null;
          }
          const next = normalizeSettings({
            ...this.access.getSettings(),
            codexPathMode: mode,
            codexPath: nextPath,
          });
          this.access.updateSettings(next);
          await this.access.saveSettings();
          this.display();
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

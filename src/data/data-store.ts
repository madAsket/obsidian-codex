import type { Plugin } from "obsidian";
import { MAX_MESSAGES } from "../constants";
import type { ChatState, CodexSettings, Message, PluginData } from "../types";
import { DEFAULT_SETTINGS, normalizeSettings } from "../settings";

const EMPTY_CHAT: ChatState = {
  threadId: null,
  messages: [],
  updatedAt: Date.now(),
};

const EMPTY_SETTINGS: CodexSettings = { ...DEFAULT_SETTINGS };

function normalizeData(raw: unknown, vaultName: string): PluginData {
  if (!raw || typeof raw !== "object") {
    return { vaultName, chat: { ...EMPTY_CHAT }, settings: { ...EMPTY_SETTINGS } };
  }

  const record = raw as Partial<PluginData>;
  const chat = record.chat ?? EMPTY_CHAT;
  const settings = normalizeSettings(record.settings ?? null);

  return {
    vaultName,
    chat: {
      threadId: chat.threadId ?? null,
      messages: Array.isArray(chat.messages) ? chat.messages : [],
      updatedAt: typeof chat.updatedAt === "number" ? chat.updatedAt : Date.now(),
    },
    settings,
  };
}

function trimMessages(messages: Message[]): Message[] {
  if (messages.length <= MAX_MESSAGES) {
    return messages;
  }
  return messages.slice(messages.length - MAX_MESSAGES);
}

export class DataStore {
  private plugin: Plugin;
  private data: PluginData;
  private settingsListeners = new Set<(settings: CodexSettings) => void>();

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.data = {
      vaultName: "",
      chat: { ...EMPTY_CHAT },
      settings: { ...EMPTY_SETTINGS },
    };
  }

  async load(vaultName: string): Promise<void> {
    const raw = await this.plugin.loadData();
    this.data = normalizeData(raw, vaultName);
  }

  getData(): PluginData {
    return this.data;
  }

  getChat(): ChatState {
    return this.data.chat;
  }

  getSettings(): CodexSettings {
    return this.data.settings;
  }

  setSettings(settings: CodexSettings): void {
    this.data.settings = settings;
    this.notifySettings();
  }

  updateSettings(partial: Partial<CodexSettings>): void {
    const next = normalizeSettings({ ...this.data.settings, ...partial });
    this.setSettings(next);
  }

  setMessages(messages: Message[]): void {
    this.data.chat.messages = trimMessages(messages);
    this.data.chat.updatedAt = Date.now();
  }

  setThreadId(threadId: string | null): void {
    this.data.chat.threadId = threadId;
    this.data.chat.updatedAt = Date.now();
  }

  updateMessage(messageId: string, text: string): void {
    const next = this.data.chat.messages.map((message) => {
      if (message.id !== messageId) {
        return message;
      }
      return { ...message, text };
    });
    this.setMessages(next);
  }

  async save(): Promise<void> {
    await this.plugin.saveData(this.data);
  }

  onSettingsChange(
    listener: (settings: CodexSettings) => void
  ): () => void {
    this.settingsListeners.add(listener);
    return () => {
      this.settingsListeners.delete(listener);
    };
  }

  private notifySettings(): void {
    for (const listener of this.settingsListeners) {
      listener(this.data.settings);
    }
  }
}

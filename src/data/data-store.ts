import { normalizePath, type Plugin } from "obsidian";
import { MAX_MESSAGES } from "../constants";
import type {
  ChatContextScope,
  ChatFile,
  ChatMeta,
  ChatUsage,
  CodexSettings,
  Message,
  PluginData,
} from "../types";
import { DEFAULT_SETTINGS, normalizeSettings } from "../settings";
import { createId } from "../utils/ids";

const EMPTY_USAGE: ChatUsage = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
};

const EMPTY_SETTINGS: CodexSettings = { ...DEFAULT_SETTINGS };

function normalizeUsage(raw: unknown): ChatUsage {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_USAGE };
  }
  const record = raw as Partial<ChatUsage>;
  return {
    inputTokens: typeof record.inputTokens === "number" ? record.inputTokens : 0,
    cachedInputTokens:
      typeof record.cachedInputTokens === "number"
        ? record.cachedInputTokens
        : 0,
    outputTokens:
      typeof record.outputTokens === "number" ? record.outputTokens : 0,
  };
}

function normalizeContextScope(raw: unknown): ChatContextScope {
  return raw === "current-note" ? "current-note" : "vault";
}

function normalizeChatMeta(raw: unknown): ChatMeta | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Partial<ChatMeta>;
  if (typeof record.id !== "string" || record.id.length === 0) {
    return null;
  }

  const createdAt =
    typeof record.createdAt === "number" ? record.createdAt : Date.now();
  const updatedAt =
    typeof record.updatedAt === "number" ? record.updatedAt : createdAt;

  return {
    id: record.id,
    title: typeof record.title === "string" ? record.title : "Chat",
    threadId:
      typeof record.threadId === "string" && record.threadId.length > 0
        ? record.threadId
        : null,
    contextScope: normalizeContextScope(record.contextScope),
    usage: normalizeUsage(record.usage),
    createdAt,
    updatedAt,
  };
}

function normalizeData(raw: unknown, vaultName: string): PluginData {
  if (!raw || typeof raw !== "object") {
    return {
      vaultName,
      activeChatId: "",
      chats: [],
      settings: { ...EMPTY_SETTINGS },
    };
  }

  const record = raw as Partial<PluginData>;
  const settings = normalizeSettings(record.settings ?? null);
  const chats = Array.isArray(record.chats)
    ? record.chats.map(normalizeChatMeta).filter(Boolean)
    : [];

  return {
    vaultName,
    activeChatId:
      typeof record.activeChatId === "string" ? record.activeChatId : "",
    chats: chats as ChatMeta[],
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
  private activeMessages: Message[] = [];
  private chatsDir: string;
  private settingsListeners = new Set<(settings: CodexSettings) => void>();

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.data = {
      vaultName: "",
      activeChatId: "",
      chats: [],
      settings: { ...EMPTY_SETTINGS },
    };
    this.chatsDir = normalizePath(
      `.obsidian/plugins/${this.plugin.manifest.id}/chats`
    );
  }

  async load(vaultName: string): Promise<void> {
    const raw = await this.plugin.loadData();
    this.data = normalizeData(raw, vaultName);
    await this.ensureChatsDir();

    let dirty = false;

    if (this.data.chats.length === 0) {
      const chat = this.createChatMeta();
      this.data.chats = [chat];
      this.data.activeChatId = chat.id;
      await this.writeChatFile(chat.id, []);
      dirty = true;
    }

    if (!this.data.activeChatId || !this.findChat(this.data.activeChatId)) {
      this.data.activeChatId = this.data.chats[0].id;
      dirty = true;
    }

    this.activeMessages = await this.readChatMessages(this.data.activeChatId);

    if (dirty) {
      await this.saveMeta();
    }
  }

  getData(): PluginData {
    return this.data;
  }

  getPluginId(): string {
    return this.plugin.manifest.id;
  }

  getChats(): ChatMeta[] {
    return [...this.data.chats];
  }

  getActiveChat(): ChatMeta {
    const chat = this.findChat(this.data.activeChatId) ?? this.data.chats[0];
    if (!chat) {
      throw new Error("No chat available");
    }
    return chat;
  }

  getMessages(): Message[] {
    return this.activeMessages;
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
    this.activeMessages = trimMessages(messages);
    const active = this.findChat(this.data.activeChatId);
    if (active) {
      active.updatedAt = Date.now();
    }
  }

  setThreadId(threadId: string | null): void {
    const active = this.findChat(this.data.activeChatId);
    if (active) {
      active.threadId = threadId;
      active.updatedAt = Date.now();
    }
  }

  updateMessage(messageId: string, text: string): void {
    const next = this.activeMessages.map((message) => {
      if (message.id !== messageId) {
        return message;
      }
      return { ...message, text };
    });
    this.setMessages(next);
  }

  updateChatUsage(usage: ChatUsage): void {
    const active = this.findChat(this.data.activeChatId);
    if (!active) {
      return;
    }
    active.usage = usage;
    active.updatedAt = Date.now();
  }

  updateChatContext(contextScope: ChatContextScope): void {
    const active = this.findChat(this.data.activeChatId);
    if (!active) {
      return;
    }
    active.contextScope = contextScope;
    active.updatedAt = Date.now();
  }

  async save(): Promise<void> {
    await this.saveMeta();
    await this.writeChatFile(this.data.activeChatId, this.activeMessages);
  }

  async saveMeta(): Promise<void> {
    await this.plugin.saveData(this.data);
  }

  async createChat(): Promise<{ chat: ChatMeta; messages: Message[] }> {
    const chat = this.createChatMeta();
    this.data.chats = [...this.data.chats, chat];
    this.data.activeChatId = chat.id;
    this.activeMessages = [];
    await this.ensureChatsDir();
    await this.writeChatFile(chat.id, []);
    await this.saveMeta();
    return { chat, messages: [] };
  }

  async switchChat(
    chatId: string
  ): Promise<{ chat: ChatMeta; messages: Message[] } | null> {
    if (chatId === this.data.activeChatId) {
      return { chat: this.getActiveChat(), messages: this.activeMessages };
    }

    const chat = this.findChat(chatId);
    if (!chat) {
      return null;
    }

    await this.save();
    this.data.activeChatId = chatId;
    this.activeMessages = await this.readChatMessages(chatId);
    await this.saveMeta();
    return { chat, messages: this.activeMessages };
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

  private createChatMeta(): ChatMeta {
    const now = Date.now();
    const index = this.data.chats.length + 1;
    return {
      id: createId("chat"),
      title: `Chat ${index}`,
      threadId: null,
      contextScope: "vault",
      usage: { ...EMPTY_USAGE },
      createdAt: now,
      updatedAt: now,
    };
  }

  private findChat(chatId: string): ChatMeta | undefined {
    return this.data.chats.find((chat) => chat.id === chatId);
  }

  private async ensureChatsDir(): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    try {
      const exists = await adapter.exists(this.chatsDir);
      if (!exists) {
        await adapter.mkdir(this.chatsDir);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Codex: failed to ensure chats dir", message);
    }
  }

  private getChatFilePath(chatId: string): string {
    return normalizePath(`${this.chatsDir}/${chatId}.json`);
  }

  private async readChatMessages(chatId: string): Promise<Message[]> {
    const adapter = this.plugin.app.vault.adapter;
    const path = this.getChatFilePath(chatId);

    try {
      const exists = await adapter.exists(path);
      if (!exists) {
        await this.ensureChatsDir();
        await this.writeChatFile(chatId, []);
        return [];
      }

      const raw = await adapter.read(path);
      const parsed = JSON.parse(raw) as Partial<ChatFile>;
      if (!parsed || !Array.isArray(parsed.messages)) {
        return [];
      }
      return trimMessages(parsed.messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Codex: failed to read chat history", message);
      return [];
    }
  }

  private async writeChatFile(chatId: string, messages: Message[]): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    const path = this.getChatFilePath(chatId);
    const payload: ChatFile = {
      messages,
      updatedAt: Date.now(),
    };

    try {
      await this.ensureChatsDir();
      await adapter.write(path, JSON.stringify(payload, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Codex: failed to write chat history", message);
    }
  }
}

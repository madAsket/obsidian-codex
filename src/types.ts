export type MessageRole = "user" | "assistant" | "system";

export type MessageMeta = {
  noteName?: string;
  notePath?: string;
  chars?: number;
};

export type Message = {
  id: string;
  role: MessageRole;
  text: string;
  ts: number;
  meta?: MessageMeta;
};

export type CodexModel = "gpt-5.2-codex" | "gpt-5.2";
export type CodexReasoning =
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type CodexPathMode = "unset" | "auto" | "custom";

export type CodexSettings = {
  model: CodexModel;
  reasoning: CodexReasoning;
  codexPathMode: CodexPathMode;
  codexPath: string | null;
  internetAccess: boolean;
  webSearch: boolean;
};

export type ChatContextScope = "vault" | "current-note";

export type ChatUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

export type ChatMeta = {
  id: string;
  title: string;
  threadId: string | null;
  contextScope: ChatContextScope;
  usage: ChatUsage;
  createdAt: number;
  updatedAt: number;
};

export type ChatFile = {
  messages: Message[];
  updatedAt: number;
};

export type PluginData = {
  vaultName: string;
  activeChatId: string;
  chats: ChatMeta[];
  settings: CodexSettings;
};

export type NoteReference = {
  name: string;
  path: string;
};

export type NoteContextErrorCode =
  | "no-active-note"
  | "unsupported-note";

export type NoteContextError = {
  code: NoteContextErrorCode;
  message: string;
};

export type NoteReferenceResult =
  | { ok: true; note: NoteReference }
  | { ok: false; error: NoteContextError };

export type AuthStatus = "unknown" | "logged-in" | "not-logged-in";

export type StatusLabel = "ready" | "busy" | "needs-login" | "error";

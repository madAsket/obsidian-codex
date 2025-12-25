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

export type ChatState = {
  threadId: string | null;
  messages: Message[];
  updatedAt: number;
};

export type CodexModel = "gpt-5.2-codex" | "gpt-5.2";
export type CodexReasoning =
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type CodexSettings = {
  model: CodexModel;
  reasoning: CodexReasoning;
};

export type PluginData = {
  vaultName: string;
  chat: ChatState;
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

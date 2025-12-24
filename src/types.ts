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

export type PluginData = {
  vaultName: string;
  chat: ChatState;
};

export type NoteContext = {
  name: string;
  path: string;
  length: number;
  content: string;
};

export type NoteContextErrorCode =
  | "no-active-note"
  | "unsupported-note"
  | "read-error";

export type NoteContextError = {
  code: NoteContextErrorCode;
  message: string;
};

export type NoteContextResult =
  | { ok: true; note: NoteContext }
  | { ok: false; error: NoteContextError };

export type AuthStatus = "unknown" | "logged-in" | "not-logged-in";

export type StatusLabel = "ready" | "busy" | "needs-login" | "error";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { App } from "obsidian";
import type { ThreadEvent } from "@openai/codex-sdk";
import { MAX_MESSAGES, NOTE_CHAR_LIMIT } from "../constants";
import type { AuthStatus, Message, StatusLabel } from "../types";
import { DataStore } from "../data/data-store";
import { createId } from "../utils/ids";
import { readActiveNote } from "../services/note-context";
import { CodexService } from "../services/codex-service";
import { buildPrompt } from "../utils/prompt";

const STATUS_LABELS: Record<StatusLabel, string> = {
  ready: "Ready",
  busy: "Busy",
  "needs-login": "Needs login",
  error: "Error",
};

const AUTH_LABELS: Record<AuthStatus, string> = {
  unknown: "Not checked",
  "logged-in": "Logged in",
  "not-logged-in": "Not logged in",
};

type ChatAppProps = {
  app: App;
  dataStore: DataStore;
};

type ErrorKind = "auth" | "not-installed" | "unexpected";

type ClassifiedError = {
  kind: ErrorKind;
  message: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function classifyCodexError(error: unknown): ClassifiedError {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("login") ||
    normalized.includes("not logged in") ||
    normalized.includes("authentication") ||
    normalized.includes("api key") ||
    normalized.includes("auth")
  ) {
    return { kind: "auth", message };
  }

  if (
    normalized.includes("codex") &&
    (normalized.includes("not found") ||
      normalized.includes("enoent") ||
      normalized.includes("spawn") ||
      normalized.includes("executable"))
  ) {
    return { kind: "not-installed", message };
  }

  return { kind: "unexpected", message };
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }
  if (error instanceof Error) {
    return error.name === "AbortError";
  }
  return false;
}

function getStatusLabel(
  busy: boolean,
  authStatus: AuthStatus,
  errorMessage: string | null,
  codexInstalled: boolean
): StatusLabel {
  if (busy) {
    return "busy";
  }
  if (!codexInstalled || errorMessage) {
    return "error";
  }
  if (authStatus === "not-logged-in") {
    return "needs-login";
  }
  return "ready";
}

export function ChatApp({ app, dataStore }: ChatAppProps): JSX.Element {
  const initialChat = dataStore.getChat();
  const [messages, setMessages] = useState<Message[]>(
    initialChat.messages ?? []
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("unknown");
  const [codexInstalled, setCodexInstalled] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>(messages);

  const service = useMemo(
    () => new CodexService(app, dataStore.getChat().threadId ?? null),
    [app, dataStore]
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!transcriptRef.current) {
      return;
    }
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setAuthChecking(true);

    service
      .checkAuth()
      .then(() => {
        if (!active) {
          return;
        }
        setAuthStatus("logged-in");
        setCodexInstalled(true);
        setErrorMessage(null);
      })
      .catch((error) => {
        console.log(error);
        if (!active) {
          return;
        }
        const classified = classifyCodexError(error);
        if (classified.kind === "auth") {
          setAuthStatus("not-logged-in");
          setCodexInstalled(true);
          setErrorMessage(null);
        } else if (classified.kind === "not-installed") {
          setCodexInstalled(false);
          setErrorMessage("Codex unavailable");
        } else {
          setErrorMessage("Unexpected error");
        }
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setAuthChecking(false);
      });

    return () => {
      active = false;
    };
  }, [service]);

  const commitMessages = useCallback(
    (updater: (prev: Message[]) => Message[], save: boolean) => {
      const next = updater(messagesRef.current);
      const trimmed =
        next.length > MAX_MESSAGES
          ? next.slice(next.length - MAX_MESSAGES)
          : next;
      messagesRef.current = trimmed;
      setMessages(trimmed);
      dataStore.setMessages(trimmed);
      if (save) {
        void dataStore.save();
      }
    },
    [dataStore]
  );

  const handleStop = useCallback(() => {
    if (!busy) {
      return;
    }
    abortRef.current?.abort();
  }, [busy]);

  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || busy) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    const userMessage: Message = {
      id: createId("user"),
      role: "user",
      text: trimmedInput,
      ts: Date.now(),
    };

    commitMessages((prev) => [...prev, userMessage], true);
    setInput("");

    const noteResult = await readActiveNote(app);
    if (!noteResult.ok) {
      const errorMessageText = noteResult.error.message;
      const systemMessage: Message = {
        id: createId("system"),
        role: "system",
        text: errorMessageText,
        ts: Date.now(),
      };
      commitMessages((prev) => [...prev, systemMessage], true);
      setBusy(false);
      return;
    }

    const assistantId = createId("assistant");
    setStreamingMessageId(assistantId);

    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      text: "Thinking...",
      ts: Date.now(),
      meta: {
        noteName: noteResult.note.name,
        notePath: noteResult.note.path,
        chars: noteResult.note.length,
      },
    };

    commitMessages((prev) => [...prev, assistantMessage], true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    let streamError: Error | null = null;

    const onEvent = (event: ThreadEvent) => {
      if (streamError) {
        return;
      }

      if (event.type === "turn.failed") {
        streamError = new Error(event.error.message);
        return;
      }

      if (event.type === "error") {
        streamError = new Error(event.message);
        return;
      }

      if (
        (event.type === "item.updated" || event.type === "item.completed") &&
        event.item.type === "agent_message"
      ) {
        const nextText = event.item.text || "";
        commitMessages(
          (prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, text: nextText }
                : message
            ),
          false
        );
      }
    };

    try {
      const prompt = buildPrompt(trimmedInput, noteResult.note);

      await service.runStreamed(prompt, {
        signal: abortController.signal,
        onThreadStarted: (threadId) => {
          dataStore.setThreadId(threadId);
          void dataStore.save();
        },
        onEvent,
      });

      if (streamError) {
        throw streamError;
      }

      setAuthStatus("logged-in");
      setCodexInstalled(true);
      setErrorMessage(null);
      void dataStore.save();
    } catch (error) {
      if (abortController.signal.aborted || isAbortError(error)) {
        commitMessages(
          (prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, text: "Cancelled" }
                : message
            ),
          true
        );
        setBusy(false);
        setStreamingMessageId(null);
        return;
      }

      const classified = classifyCodexError(error);

      if (classified.kind === "auth") {
        setAuthStatus("not-logged-in");
        commitMessages(
          (prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    text: "Needs login. Run codex login in terminal.",
                  }
                : message
            ),
          true
        );
        setErrorMessage(null);
      } else if (classified.kind === "not-installed") {
        setCodexInstalled(false);
        setErrorMessage("Codex unavailable");
        commitMessages(
          (prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, text: "Codex unavailable" }
                : message
            ),
          true
        );
      } else {
        setErrorMessage("Unexpected error");
        commitMessages(
          (prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, text: "Unexpected error" }
                : message
            ),
          true
        );
      }
    } finally {
      setBusy(false);
      setStreamingMessageId(null);
      abortRef.current = null;
    }
  }, [app, busy, commitMessages, dataStore, input, service]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter") {
        return;
      }

      if (event.shiftKey) {
        return;
      }

      event.preventDefault();
      void handleSend();
    },
    [handleSend]
  );

  const statusLabel = getStatusLabel(
    busy,
    authStatus,
    errorMessage,
    codexInstalled
  );

  const statusText = STATUS_LABELS[statusLabel];
  const authText = authChecking ? "Checking..." : AUTH_LABELS[authStatus];
  const vaultName = dataStore.getData().vaultName || app.vault.getName();
  const noteLimitText = `${NOTE_CHAR_LIMIT.toLocaleString("en-US")} chars`;

  return (
    <div className="codex-shell">
      <div className="codex-header">
        <div>
          <div className="codex-title">Codex</div>
          <div className={`codex-status codex-status-${statusLabel}`}>
            <span className="codex-status-dot" aria-hidden="true" />
            {statusText}
          </div>
        </div>
      </div>

      <div className="codex-status-block">
        <div className="codex-status-row">
          <span className="codex-status-label">Codex installed</span>
          <span className="codex-status-value">
            {codexInstalled ? "Yes" : "No"}
          </span>
        </div>
        <div className="codex-status-row">
          <span className="codex-status-label">Auth</span>
          <span className="codex-status-value">{authText}</span>
        </div>
        <div className="codex-status-row">
          <span className="codex-status-label">Vault</span>
          <span className="codex-status-value">{vaultName}</span>
        </div>
        <div className="codex-status-row">
          <span className="codex-status-label">Safety</span>
          <span className="codex-status-value">Read-only</span>
        </div>
        <div className="codex-status-row">
          <span className="codex-status-label">Note limit</span>
          <span className="codex-status-value">{noteLimitText}</span>
        </div>
        {authStatus === "not-logged-in" ? (
          <div className="codex-status-hint">
            Run <strong>codex login</strong> in terminal.
          </div>
        ) : null}
        {errorMessage ? (
          <div className="codex-status-alert">{errorMessage}</div>
        ) : null}
      </div>

      <div className="codex-transcript" ref={transcriptRef}>
        {messages.length === 0 ? (
          <div className="codex-empty">
            Ask a question about the active note.
          </div>
        ) : (
          messages.map((message) => {
            const roleLabel =
              message.role === "user"
                ? "You"
                : message.role === "assistant"
                ? "Codex"
                : "System";
            const isStreaming = message.id === streamingMessageId;

            return (
              <div
                key={message.id}
                className={`codex-message codex-message-${message.role} ${
                  isStreaming ? "codex-message-streaming" : ""
                }`}
              >
                <div className="codex-message-role">{roleLabel}</div>
                <div className="codex-message-text">{message.text}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="codex-input">
        <textarea
          className="codex-textarea"
          placeholder="Ask about the active note..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          rows={3}
        />
        <div className="codex-input-actions">
          <button
            type="button"
            className="codex-stop"
            onClick={handleStop}
            disabled={!busy}
          >
            Stop
          </button>
          <button
            type="button"
            className="codex-send"
            onClick={() => void handleSend()}
            disabled={busy || input.trim().length === 0}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

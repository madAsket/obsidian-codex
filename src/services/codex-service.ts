import { Codex, type Input, type Thread, type ThreadEvent, type ThreadOptions } from "@openai/codex-sdk";
import type { App } from "obsidian";
import { FileSystemAdapter } from "obsidian";
import { AUTH_CHECK_PROMPT } from "../constants";
import { buildCodexEnv, resolveCodexPath } from "../utils/codex-path";

const DEFAULT_THREAD_OPTIONS: ThreadOptions = {
  sandboxMode: "read-only",
  approvalPolicy: "never",
  networkAccessEnabled: false,
  webSearchEnabled: false,
  skipGitRepoCheck: true,
};

function getVaultBasePath(app: App): string | null {
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath();
  }
  return null;
}

export type StreamHandlers = {
  signal?: AbortSignal;
  onEvent?: (event: ThreadEvent) => void;
  onThreadStarted?: (threadId: string) => void;
};

export class CodexService {
  private app: App;
  private codex: Codex;
  private thread: Thread | null = null;
  private threadId: string | null;
  private threadOptions: ThreadOptions;

  constructor(app: App, threadId: string | null) {
    this.app = app;
    this.threadId = threadId;
    const codexPath = resolveCodexPath();
    this.codex = new Codex({
      codexPathOverride: codexPath ?? "codex",
      env: buildCodexEnv(codexPath ?? null),
    });

    const vaultPath = getVaultBasePath(app);
    this.threadOptions = {
      ...DEFAULT_THREAD_OPTIONS,
      workingDirectory: vaultPath ?? undefined,
    };
  }

  getCurrentThreadId(): string | null {
    return this.threadId;
  }

  private ensureThread(): void {
    if (this.thread) {
      return;
    }

    this.thread = this.threadId
      ? this.codex.resumeThread(this.threadId, this.threadOptions)
      : this.codex.startThread(this.threadOptions);
  }

  async runStreamed(input: Input, handlers: StreamHandlers): Promise<void> {
    this.ensureThread();

    if (!this.thread) {
      throw new Error("Failed to initialize Codex thread");
    }

    const { events } = await this.thread.runStreamed(input, {
      signal: handlers.signal,
    });

    for await (const event of events) {
      if (event.type === "thread.started") {
        this.threadId = event.thread_id;
        handlers.onThreadStarted?.(event.thread_id);
      }

      handlers.onEvent?.(event);
    }
  }

  async checkAuth(): Promise<void> {
    const thread = this.codex.startThread(this.threadOptions);
    await thread.run(AUTH_CHECK_PROMPT);
  }
}

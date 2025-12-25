import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { Codex, type Input, type Thread, type ThreadEvent, type ThreadOptions } from "@openai/codex-sdk";
import type { App } from "obsidian";
import { FileSystemAdapter } from "obsidian";
import { buildCodexEnv, resolveCodexPath } from "../utils/codex-path";
import type { AuthStatus, CodexSettings } from "../types";

const DEFAULT_THREAD_OPTIONS: ThreadOptions = {
  sandboxMode: "workspace-write",
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
  private baseThreadOptions: ThreadOptions;
  private codexPath: string;
  private codexEnv: Record<string, string>;
  private codexInstalled: boolean;

  constructor(app: App, threadId: string | null, settings: CodexSettings) {
    this.app = app;
    this.threadId = threadId;
    const resolvedCodexPath = resolveCodexPath();
    this.codexInstalled = resolvedCodexPath !== null;
    this.codexPath = resolvedCodexPath ?? "codex";
    this.codexEnv = buildCodexEnv(this.codexPath);
    this.codex = new Codex({
      codexPathOverride: this.codexPath,
      env: this.codexEnv,
    });

    const vaultPath = getVaultBasePath(app);
    this.baseThreadOptions = {
      ...DEFAULT_THREAD_OPTIONS,
      workingDirectory: vaultPath ?? undefined,
    };
    this.threadOptions = {
      ...this.baseThreadOptions,
      model: settings.model,
      modelReasoningEffort: settings.reasoning,
    };
  }

  getCurrentThreadId(): string | null {
    return this.threadId;
  }

  updateThreadSettings(settings: CodexSettings): void {
    this.threadOptions = {
      ...this.baseThreadOptions,
      model: settings.model,
      modelReasoningEffort: settings.reasoning,
    };
    this.thread = null;
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

  async checkAuthStatus(): Promise<{
    authStatus: AuthStatus;
    codexInstalled: boolean;
    errorMessage: string | null;
  }> {
    if (!this.codexInstalled) {
      return {
        authStatus: "unknown",
        codexInstalled: false,
        errorMessage: null,
      };
    }

    const loggedIn = await checkLoginStatus(
      this.codexPath,
      this.codexEnv
    );
    return {
      authStatus: loggedIn ? "logged-in" : "not-logged-in",
      codexInstalled: true,
      errorMessage: null,
    };
  }
}

function hasAuthFile(): boolean {
  const authPath = path.join(os.homedir(), ".codex", "auth.json");
  try {
    return fs.existsSync(authPath);
  } catch (error) {
    return false;
  }
}

async function checkLoginStatus(
  command: string,
  env: Record<string, string>
): Promise<boolean> {
  try {
    const exitCode = await runLoginStatus(command, env);
    if (exitCode === 0) {
      return true;
    }
  } catch (error) {
    console.warn("Codex: login status check failed", error);
  }

  return hasAuthFile();
}

function runLoginStatus(
  command: string,
  env: Record<string, string>
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["login", "status"], { env });
    let settled = false;

    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });

    child.once("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(code);
    });
  });
}

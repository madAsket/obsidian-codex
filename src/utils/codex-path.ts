import fs from "fs";
import os from "os";
import path from "path";

const WIN_BIN_NAMES = ["codex.exe", "codex.cmd", "codex.bat"];
const BIN_NAMES = process.platform === "win32" ? WIN_BIN_NAMES : ["codex"];
const EXPLICIT_PATH_KEYS = ["CODEX_PATH", "CODEX_BIN"];

const FALLBACK_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
  "/snap/bin",
  path.join(os.homedir(), ".local/bin"),
  path.join(os.homedir(), ".nix-profile/bin"),
];

function splitPath(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value.split(path.delimiter).filter(Boolean);
}

function unique(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    if (seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });
}

function findBinInDir(dir: string): string | null {
  for (const name of BIN_NAMES) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveExplicitPath(): string | null {
  for (const key of EXPLICIT_PATH_KEYS) {
    const value = process.env[key]?.trim();
    if (!value) {
      continue;
    }
    if (fs.existsSync(value)) {
      return value;
    }
  }
  return null;
}

function resolveNvmBins(): string[] {
  const nvmDir = process.env.NVM_DIR ?? path.join(os.homedir(), ".nvm");
  const versionsDir = path.join(nvmDir, "versions", "node");

  try {
    const entries = fs.readdirSync(versionsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(versionsDir, entry.name, "bin"));
  } catch (error) {
    return [];
  }
}

function getSearchDirs(): string[] {
  const envPaths = splitPath(process.env.PATH);
  const nvmBin = process.env.NVM_BIN ? [process.env.NVM_BIN] : [];
  const nvmBins = resolveNvmBins();
  return unique([...envPaths, ...nvmBin, ...nvmBins, ...FALLBACK_DIRS]);
}

export function resolveCodexPath(preferredPath?: string | null): string | null {
  const trimmedPreferred = preferredPath?.trim();
  if (trimmedPreferred) {
    return fs.existsSync(trimmedPreferred) ? trimmedPreferred : null;
  }

  const explicitPath = resolveExplicitPath();
  if (explicitPath) {
    return explicitPath;
  }

  for (const dir of getSearchDirs()) {
    const candidate = findBinInDir(dir);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export type CodexCandidate = {
  label: string;
  path: string;
};

export function getCodexCandidates(pluginDir?: string | null): CodexCandidate[] {
  const candidates: CodexCandidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (label: string, candidatePath: string | null) => {
    if (!candidatePath || seen.has(candidatePath)) {
      return;
    }
    seen.add(candidatePath);
    candidates.push({ label, path: candidatePath });
  };

  addCandidate("Env (CODEX_PATH/CODEX_BIN)", resolveExplicitPath());

  if (pluginDir) {
    const localBin = findBinInDir(path.join(pluginDir, "bin"));
    addCandidate("Plugin (downloaded)", localBin);
    const npmBin = findBinInDir(path.join(pluginDir, "node_modules", ".bin"));
    addCandidate("Plugin (node_modules/.bin)", npmBin);
  }

  for (const dir of getSearchDirs()) {
    const candidate = findBinInDir(dir);
    if (candidate) {
      addCandidate(`System: ${dir}`, candidate);
    }
  }

  return candidates;
}

export function buildCodexEnv(codexPath?: string | null): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  const explicitPath = resolveExplicitPath();
  const explicitDir = explicitPath ? path.dirname(explicitPath) : null;
  const resolvedDir = codexPath ? path.dirname(codexPath) : null;
  const existing = splitPath(env.PATH);
  const nvmBin = process.env.NVM_BIN ? [process.env.NVM_BIN] : [];
  const nvmBins = resolveNvmBins();
  env.PATH = unique([
    ...(resolvedDir ? [resolvedDir] : []),
    ...(explicitDir ? [explicitDir] : []),
    ...nvmBin,
    ...nvmBins,
    ...existing,
    ...FALLBACK_DIRS,
  ]).join(path.delimiter);
  return env;
}

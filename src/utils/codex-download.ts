import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { requestUrl } from "obsidian";
import { CODEX_RELEASE_TAG } from "../constants";

type DownloadSpec = {
  assetName: string;
  archive: boolean;
  binName: string;
  extractedName?: string;
};

const BIN_NAME = process.platform === "win32" ? "codex.exe" : "codex";

function getDownloadSpec(): DownloadSpec {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin" && arch === "arm64") {
    return {
      assetName: "codex-aarch64-apple-darwin.tar.gz",
      archive: true,
      binName: BIN_NAME,
      extractedName: "codex-aarch64-apple-darwin",
    };
  }

  if (platform === "darwin" && arch === "x64") {
    return {
      assetName: "codex-x86_64-apple-darwin.tar.gz",
      archive: true,
      binName: BIN_NAME,
      extractedName: "codex-x86_64-apple-darwin",
    };
  }

  if (platform === "linux" && arch === "x64") {
    return {
      assetName: "codex-x86_64-unknown-linux-gnu.tar.gz",
      archive: true,
      binName: BIN_NAME,
      extractedName: "codex-x86_64-unknown-linux-gnu",
    };
  }

  if (platform === "linux" && arch === "arm64") {
    return {
      assetName: "codex-aarch64-unknown-linux-gnu.tar.gz",
      archive: true,
      binName: BIN_NAME,
      extractedName: "codex-aarch64-unknown-linux-gnu",
    };
  }

  if (platform === "win32" && arch === "x64") {
    return {
      assetName: "codex-x86_64-pc-windows-msvc.exe",
      archive: false,
      binName: BIN_NAME,
    };
  }

  if (platform === "win32" && arch === "arm64") {
    return {
      assetName: "codex-aarch64-pc-windows-msvc.exe",
      archive: false,
      binName: BIN_NAME,
    };
  }

  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

function buildDownloadUrl(assetName: string): string {
  return `https://github.com/openai/codex/releases/download/${CODEX_RELEASE_TAG}/${assetName}`;
}

function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", ["-xzf", archivePath, "-C", destDir]);
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => reject(error));
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(stderr.trim() || `tar exited with code ${code ?? "unknown"}`)
      );
    });
  });
}

async function resolveExtractedBinary(
  binDir: string,
  binName: string,
  extractedName?: string
): Promise<string | null> {
  const targetPath = path.join(binDir, binName);
  if (fs.existsSync(targetPath)) {
    return targetPath;
  }

  if (extractedName) {
    const extractedPath = path.join(binDir, extractedName);
    if (fs.existsSync(extractedPath)) {
      await fs.promises.rm(targetPath, { force: true });
      await fs.promises.rename(extractedPath, targetPath);
      return targetPath;
    }
  }

  const entries = await fs.promises.readdir(binDir, { withFileTypes: true });
  const fallback = entries.find(
    (entry) => entry.isFile() && entry.name.startsWith("codex-")
  );
  if (fallback) {
    const fallbackPath = path.join(binDir, fallback.name);
    await fs.promises.rm(targetPath, { force: true });
    await fs.promises.rename(fallbackPath, targetPath);
    return targetPath;
  }

  return null;
}

export async function downloadCodexBinary(
  pluginRoot: string
): Promise<{ path: string; url: string }> {
  const spec = getDownloadSpec();
  const url = buildDownloadUrl(spec.assetName);
  const binDir = path.join(pluginRoot, "bin");
  const binPath = path.join(binDir, spec.binName);

  await fs.promises.mkdir(binDir, { recursive: true });

  if (!spec.archive) {
    const response = await requestUrl({ url, method: "GET" });
    await fs.promises.writeFile(binPath, Buffer.from(response.arrayBuffer));
    return { path: binPath, url };
  }

  const tmpPath = path.join(
    os.tmpdir(),
    `codex-${Date.now()}-${spec.assetName}`
  );

  try {
    const response = await requestUrl({ url, method: "GET" });
    await fs.promises.writeFile(tmpPath, Buffer.from(response.arrayBuffer));
    await extractTarGz(tmpPath, binDir);
  } finally {
    try {
      await fs.promises.rm(tmpPath, { force: true });
    } catch (error) {
      // ignore cleanup errors
    }
  }

  const resolvedPath = await resolveExtractedBinary(
    binDir,
    spec.binName,
    spec.extractedName
  );
  if (!resolvedPath) {
    throw new Error("Downloaded archive did not contain the codex binary.");
  }

  if (process.platform !== "win32") {
    await fs.promises.chmod(resolvedPath, 0o755);
  }

  return { path: resolvedPath, url };
}

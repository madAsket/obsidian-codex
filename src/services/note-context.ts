import type { App, TFile } from "obsidian";
import { ALLOWED_NOTE_EXTENSIONS, NOTE_CHAR_LIMIT } from "../constants";
import type { NoteContextResult } from "../types";

function isMarkdown(file: TFile): boolean {
  const extension = file.extension.toLowerCase();
  return ALLOWED_NOTE_EXTENSIONS.includes(extension);
}

export async function readActiveNote(app: App): Promise<NoteContextResult> {
  const file = app.workspace.getActiveFile();
  if (!file) {
    return {
      ok: false,
      error: { code: "no-active-note", message: "Open a note first" },
    };
  }

  if (!isMarkdown(file)) {
    return {
      ok: false,
      error: { code: "unsupported-note", message: "Only markdown notes supported" },
    };
  }

  try {
    const content = await app.vault.read(file);
    const trimmed =
      content.length > NOTE_CHAR_LIMIT
        ? content.slice(0, NOTE_CHAR_LIMIT)
        : content;

    return {
      ok: true,
      note: {
        name: file.name,
        path: file.path,
        length: content.length,
        content: trimmed,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read note";
    return {
      ok: false,
      error: { code: "read-error", message },
    };
  }
}

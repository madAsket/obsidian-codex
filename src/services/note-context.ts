import type { App, TFile } from "obsidian";
import { ALLOWED_NOTE_EXTENSIONS } from "../constants";
import type { NoteReferenceResult } from "../types";

function isMarkdown(file: TFile): boolean {
  const extension = file.extension.toLowerCase();
  return ALLOWED_NOTE_EXTENSIONS.includes(extension);
}

export function getActiveNoteReference(app: App): NoteReferenceResult {
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
      error: {
        code: "unsupported-note",
        message: "Only markdown notes supported",
      },
    };
  }

  return {
    ok: true,
    note: {
      name: file.name,
      path: file.path,
    },
  };
}

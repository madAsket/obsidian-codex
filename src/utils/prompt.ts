import { SYSTEM_PROMPT_NOTE, SYSTEM_PROMPT_VAULT } from "../constants";
import type { NoteReference } from "../types";

export function buildPrompt(
  userText: string,
  scope: "current-note" | "vault",
  note?: NoteReference
): string {
  if (scope === "vault") {
    return [SYSTEM_PROMPT_VAULT, "", "User request:", userText].join("\n");
  }

  if (!note) {
    throw new Error("Note context required for current note prompt");
  }

  return [
    SYSTEM_PROMPT_NOTE,
    "",
    "Edit this note:",
    `@${note.path}`,
    "",
    "User request:",
    userText,
  ].join("\n");
}

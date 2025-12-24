import { SYSTEM_PROMPT } from "../constants";
import type { NoteContext } from "../types";

export function buildPrompt(userText: string, note: NoteContext): string {
  return [
    SYSTEM_PROMPT,
    "",
    "User question:",
    userText,
    "",
    "Note metadata:",
    `Name: ${note.name}`,
    `Path: ${note.path}`,
    `Length: ${note.length} characters`,
    "",
    "Note content:",
    note.content,
  ].join("\n");
}

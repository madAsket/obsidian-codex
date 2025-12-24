export const VIEW_TYPE = "codex-sidebar";
export const VIEW_TITLE = "Codex";

export const NOTE_CHAR_LIMIT = 50000;
export const MAX_MESSAGES = 150;
export const ALLOWED_NOTE_EXTENSIONS = ["md", "markdown"];

export const AGENTS_FILE = "AGENTS.md";
export const AGENTS_CONTENT = `# Obsidian vault instructions\n\n- This vault contains Markdown notes.\n- Read-only mode: do not modify or create files, do not run commands, and do not use the internet.\n- When answering questions about notes, use only the note text and do not invent facts.\n`;

export const SYSTEM_PROMPT = [
  "Respond in the user's language.",
  "Base your answer only on the provided note text.",
  "Keep it brief and to the point.",
  "This is an Obsidian vault. Notes are Markdown.",
  "Read-only mode: do not modify or create files, do not run commands, and do not use the internet.",
  "Do not use tools or web search.",
].join("\n");

export const AUTH_CHECK_PROMPT = [
  "Auth check.",
  "Reply with OK.",
].join("\n");

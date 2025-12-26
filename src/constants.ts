export const VIEW_TYPE = "codex-sidebar";
export const VIEW_TITLE = "Redstone Copilot";

export const MAX_MESSAGES = 150;
export const ALLOWED_NOTE_EXTENSIONS = ["md", "markdown"];

export const CODEX_RELEASE_TAG = "rust-v0.77.0";

export const AGENTS_FILE = "AGENTS.md";
export const LEGACY_AGENTS_CONTENT = `# Obsidian vault instructions\n\n- This vault contains Markdown notes.\n- Read-only mode: do not modify or create files, do not run commands, and do not use the internet.\n- When answering questions about notes, use only the note text and do not invent facts.\n`;
export const AGENTS_CONTENT = `# Obsidian vault instructions\n\n- This vault contains Markdown notes.\n- Do not read or access the \`.obsidian/\` directory at the vault root.\n- When answering questions about notes do not invent facts.\n`;

export const SYSTEM_PROMPT_NOTE = [
  "Respond in the user's language.",
  "Keep it brief and to the point.",
  "This is an Obsidian vault. Notes are Markdown.",
].join("\n");

export const SYSTEM_PROMPT_VAULT = SYSTEM_PROMPT_NOTE;

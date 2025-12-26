<div align="center">

<!-- TODO: Replace with a real logo if/when you have one -->
<!-- <img src="assets/logo.png" alt="Redstone Copilot" width="120" /> -->

# Redstone Copilot

**A modern, convenient Codex-powered copilot sidebar for Obsidian.**

<!-- Badges (release number comes from GitHub Releases) -->
[![Release](https://img.shields.io/github/v/release/madAsket/obsidian-codex?display_name=tag&sort=semver)](https://github.com/madAsket/obsidian-codex/releases)
[![Downloads](https://img.shields.io/github/downloads/madAsket/obsidian-codex/total)](https://github.com/madAsket/obsidian-codex/releases)
[![License](https://img.shields.io/github/license/madAsket/obsidian-codex)](./LICENSE)

</div>

> [!NOTE]
> This plugin is powered by the **Codex CLI**. It uses your **global Codex installation and auth** (typically `~/.codex`).

---

## Screenshot

<!-- TODO: Replace with a real screenshot before publishing -->
![Redstone Copilot UI (placeholder)](assets/screenshot-placeholder.png)

---

## Important limitations (MVP)

> [!WARNING]
> **Global Codex CLI only.** This plugin currently works with your **globally installed** `@openai/codex` and its global auth/config. Per-vault Codex profiles (e.g. vault-local `CODEX_HOME`) are **not supported** right now.

> [!WARNING]
> **Desktop-only:** macOS and Linux are supported. Windows and mobile are not supported in the current release.

---

## Why Codex CLI is great (and why this plugin builds on it)

- **Sign in with ChatGPT** — we recommend signing into your ChatGPT account to use Codex as part of your Plus, Pro, Team, Edu, or Enterprise plan.
  - Learn what’s included in your ChatGPT plan: https://help.openai.com/en/articles/11369540-codex-in-chatgpt
- **Chat history built-in** — Codex manages conversation threads and can resume them across sessions.
- **Directory-aware by design** — Codex is built to work inside a project folder, so it can reason over files in your vault (with the safety constraints you choose).

---

## What you can do

- Open the Codex sidebar from the ribbon icon (left toolbar).
- Chat with Codex to answer questions or create/edit notes in your vault.
- Choose context:
  - Use **only the current note**, or
  - Use the **whole vault** as context.
- Create multiple chats and switch between them (each chat keeps its own history).
- See per-chat token usage in the header.
- Stop a running response (the message is marked as *Cancelled*).
- Open plugin settings from the header gear icon.

---

## Installation

### 1) Install Codex CLI (global)

```bash
npm install -g @openai/codex
```

More info: https://developers.openai.com/codex/cli/

### 2) Sign in once (terminal)

Run Codex in your terminal and follow the prompts:

```bash
codex
```

### 3) Enable the plugin in Obsidian

- Open **Settings → Community plugins**
- Enable this plugin
- Open the sidebar from the ribbon icon

If Codex is missing or you are not logged in, the sidebar shows a short message with a **Retry** button.

---

## AGENTS.md (vault instructions)

This plugin creates an `AGENTS.md` file in your **vault root**.

- It contains baseline instructions so Codex understands it’s working inside an Obsidian vault.
- You can **freely edit** `AGENTS.md` to add your own rules and conventions.

### Why you should edit it

Different vaults have different conventions:
- Zettelkasten vs PARA vs project-based vaults
- Frontmatter schemas
- Tagging rules
- Folder structures
- Templates

Add instructions like:
- Where new notes should be created
- How to name files
- What frontmatter fields are required
- What style/format you want for summaries

> [!TIP]
> Treat `AGENTS.md` as your “vault handbook” for AI.

---

## Settings

- **Model and reasoning level** (applies immediately).
- **Internet access** (optional, off by default).
- **Web search requests** (only available when Internet access is on).

---

## Support

- Questions / ideas: **GitHub Discussions** (link to be added)
- Bug reports: **GitHub Issues** (link to be added)

Repository: https://github.com/madAsket/obsidian-codex

---

## Buy me a coffee

If this plugin saves you time, consider supporting it:

<a href="https://buymeacoffee.com/placeholder" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="45">
</a>

---

## Disclaimer

This is an independent community plugin and is not affiliated with Obsidian or OpenAI.


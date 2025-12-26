import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import type CodexPlugin from "../main";
import { VIEW_TITLE, VIEW_TYPE } from "../constants";
import { ChatApp } from "./ChatApp";

export class CodexView extends ItemView {
  private plugin: CodexPlugin;
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: CodexPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return VIEW_TITLE;
  }

  getIcon(): string {
    return "message-circle-code";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    const container = this.contentEl.createDiv({ cls: "codex-view" });
    this.root = createRoot(container);
    this.root.render(
      <ChatApp app={this.app} dataStore={this.plugin.dataStore} />
    );
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

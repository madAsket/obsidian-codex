import React from "react";
import type { ChatMeta } from "../../types";
import { SettingsIcon } from "./icons";

type ChatHeaderProps = {
	title: string;
	showIndicator: boolean;
	indicatorState: string;
	showControls: boolean;
	activeChatId: string;
	chatList: ChatMeta[];
	busy: boolean;
	onChatChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
	onNewChat: () => void;
	onOpenSettings: () => void;
	tokenSummary: string;
};

export function ChatHeader({
	title,
	showIndicator,
	indicatorState,
	showControls,
	activeChatId,
	chatList,
	busy,
	onChatChange,
	onNewChat,
	onOpenSettings,
	tokenSummary,
}: ChatHeaderProps): React.JSX.Element {
	return (
		<div className="codex-header">
			<div className="codex-title-wrap">
				{showIndicator ? (
					<span
						className={`codex-title-dot codex-title-dot-${indicatorState}`}
						aria-hidden="true"
					/>
				) : null}
				<div className="codex-title">{title}</div>
			</div>
			{showControls ? (
				<div className="codex-header-right">
					<div className="codex-chat-controls">
						<select
							className="codex-chat-select"
							value={activeChatId}
							onChange={onChatChange}
							disabled={busy}
							aria-label="Chat"
						>
							{chatList.map((chat) => (
								<option key={chat.id} value={chat.id}>
									{chat.title}
								</option>
							))}
						</select>
						<button
							type="button"
							className="codex-chat-new"
							onClick={onNewChat}
							disabled={busy}
						>
							New chat
						</button>
						<button
							type="button"
							className="codex-chat-settings"
							onClick={onOpenSettings}
							aria-label="Open settings"
						>
							<SettingsIcon />
						</button>
					</div>
					<div className="codex-header-meta">{tokenSummary}</div>
				</div>
			) : null}
		</div>
	);
}

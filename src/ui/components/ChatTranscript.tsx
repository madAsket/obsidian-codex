import React from "react";
import type { Message } from "../../types";

type ChatTranscriptProps = {
	messages: Message[];
	contextScope: "vault" | "current-note";
	streamingMessageId: string | null;
};

export const ChatTranscript = React.forwardRef<
	HTMLDivElement,
	ChatTranscriptProps
>(function ChatTranscript(
	{ messages, contextScope, streamingMessageId },
	ref
): JSX.Element {
	return (
		<div className="codex-transcript" ref={ref}>
			{messages.length === 0 ? (
				<div className="codex-empty">
					{contextScope === "vault"
						? "Ask a question about your vault."
						: "Ask a question about the active note."}
				</div>
			) : (
				messages.map((message) => {
					const isStreaming = message.id === streamingMessageId;

					return (
						<div
							key={message.id}
							className={`codex-message codex-message-${
								message.role
							} ${
								isStreaming ? "codex-message-streaming" : ""
							}`}
						>
							<div className="codex-message-text">{message.text}</div>
						</div>
					);
				})
			)}
		</div>
	);
});

ChatTranscript.displayName = "ChatTranscript";

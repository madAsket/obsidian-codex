import React from "react";
import { SendIcon, StopIcon } from "./icons";

type ChatInputProps = {
	input: string;
	placeholder: string;
	busy: boolean;
	actionLabel: string;
	actionDisabled: boolean;
	contextScope: "vault" | "current-note";
	onInputChange: (value: string) => void;
	onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	onContextChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
	onSend: () => void;
	onStop: () => void;
};

export function ChatInput({
	input,
	placeholder,
	busy,
	actionLabel,
	actionDisabled,
	contextScope,
	onInputChange,
	onKeyDown,
	onContextChange,
	onSend,
	onStop,
}: ChatInputProps): React.JSX.Element {
	return (
		<div className="codex-input">
			<textarea
				className="codex-textarea"
				placeholder={placeholder}
				value={input}
				onChange={(event) => onInputChange(event.target.value)}
				onKeyDown={onKeyDown}
				disabled={busy}
				rows={3}
			/>
			<div className="codex-input-actions">
				<div className="codex-toolbox-field">
					<span className="codex-toolbox-label">Context</span>
					<select
						className="codex-toolbox-select"
						value={contextScope}
						onChange={onContextChange}
						disabled={busy}
						aria-label="Context"
					>
						<option value="vault">Vault</option>
						<option value="current-note">Current note</option>
					</select>
				</div>
				<button
					type="button"
					className={`codex-action ${busy ? "codex-action-stop" : ""}`}
					onClick={busy ? onStop : onSend}
					disabled={actionDisabled}
					aria-label={actionLabel}
				>
					{busy ? <StopIcon /> : <SendIcon />}
				</button>
			</div>
		</div>
	);
}

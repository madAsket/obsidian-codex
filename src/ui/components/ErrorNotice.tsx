import React from "react";

type ErrorNoticeProps = {
	visible: boolean;
	errorMessage: string | null;
	onRetry: () => void;
	retryDisabled: boolean;
};

export function ErrorNotice({
	visible,
	errorMessage,
	onRetry,
	retryDisabled,
}: ErrorNoticeProps): React.JSX.Element | null {
	if (!visible) {
		return null;
	}

	return (
		<div className="codex-empty-state">
			<div className="codex-empty-title">Unexpected error</div>
			<div className="codex-empty-text">
				{errorMessage ?? "Something went wrong."}
			</div>
			<button
				type="button"
				className="codex-retry"
				onClick={onRetry}
				disabled={retryDisabled}
			>
				Retry
			</button>
		</div>
	);
}

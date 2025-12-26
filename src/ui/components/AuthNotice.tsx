import React from "react";

type AuthNoticeProps = {
	visible: boolean;
	loginUrl: string | null;
	loginBusy: boolean;
	retryDisabled: boolean;
	loginError: string | null;
	onAuthorize: () => void;
	onCheck: () => void;
};

export function AuthNotice({
	visible,
	loginUrl,
	loginBusy,
	retryDisabled,
	loginError,
	onAuthorize,
	onCheck,
}: AuthNoticeProps): React.JSX.Element | null {
	if (!visible) {
		return null;
	}

	return (
		<div className="codex-empty-state">
			<div className="codex-empty-title">Login to Codex CLI</div>
			<div className="codex-auth-actions">
				<button
					type="button"
					className="codex-auth-button"
					onClick={onAuthorize}
					disabled={loginBusy || retryDisabled}
				>
					Authorize in browser
				</button>
				{loginUrl ? (
					<a
						className="codex-link"
						href={loginUrl}
						target="_blank"
						rel="noreferrer"
					>
						Open login page
					</a>
				) : null}
			</div>
			<div className="codex-empty-text">
				Or run <code>codex</code> in your terminal to sign in and click
				button below.
			</div>
			<button
				type="button"
				className="codex-retry"
				onClick={onCheck}
				disabled={retryDisabled}
			>
				Check
			</button>
			{loginError ? (
				<div className="codex-empty-text codex-auth-error">
					{loginError}
				</div>
			) : null}
		</div>
	);
}

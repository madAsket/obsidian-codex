import React from "react";

type CheckingNoticeProps = {
	visible: boolean;
};

export function CheckingNotice({
	visible,
}: CheckingNoticeProps): React.JSX.Element | null {
	if (!visible) {
		return null;
	}

	return (
		<div className="codex-empty-state">
			<div className="codex-empty-title">Checking Codex status</div>
			<div className="codex-empty-text">
				Hold on while we verify your setup.
			</div>
		</div>
	);
}

import React from "react";
import type { CodexCandidate } from "../../utils/codex-path";

type BootstrapPanelProps = {
	visible: boolean;
	candidates: CodexCandidate[];
	selectedCandidate: string;
	onSelectCandidate: (value: string) => void;
	onSaveCandidate: () => void;
	onDownload: () => void;
	onCheckInstall: () => void;
	busy: boolean;
	errorMessage: string | null;
	pluginRootAvailable: boolean;
	installUrl: string;
};

export function BootstrapPanel({
	visible,
	candidates,
	selectedCandidate,
	onSelectCandidate,
	onSaveCandidate,
	onDownload,
	onCheckInstall,
	busy,
	errorMessage,
	pluginRootAvailable,
	installUrl,
}: BootstrapPanelProps): JSX.Element | null {
	if (!visible) {
		return null;
	}

	const hasCandidates = candidates.length > 0;

	return (
		<div className="codex-bootstrap">
			<div className="codex-bootstrap-title">
				Step 1. Set up Codex CLI
			</div>
			<div className="codex-bootstrap-section">
				<div className="codex-bootstrap-label">
					Option 1: Use a detected Codex CLI
				</div>
				{hasCandidates ? (
					<div className="codex-bootstrap-row">
						<select
							className="codex-bootstrap-select"
							value={selectedCandidate}
							onChange={(event) => onSelectCandidate(event.target.value)}
							disabled={busy}
							aria-label="Detected Codex CLI"
						>
							{candidates.map((candidate) => (
								<option key={candidate.path} value={candidate.path}>
									{candidate.label}
								</option>
							))}
						</select>
						<button
							type="button"
							className="codex-bootstrap-button"
							onClick={onSaveCandidate}
							disabled={busy || !selectedCandidate}
						>
							Save
						</button>
					</div>
				) : (
					<div className="codex-bootstrap-muted">
						No Codex binaries detected.
					</div>
				)}
			</div>

			<div className="codex-bootstrap-section">
				<div className="codex-bootstrap-label">
					Option 2: Download Codex CLI
				</div>
				<button
					type="button"
					className="codex-bootstrap-button"
					onClick={onDownload}
					disabled={busy || !pluginRootAvailable}
				>
					Download
				</button>
			</div>

			<div className="codex-bootstrap-section">
				<div className="codex-bootstrap-label">
					Option 3: Install manually
				</div>
				<div className="codex-bootstrap-text">
					Run <br />
					<code>
						<b>npm install -g @openai/codex</b>
					</code>
					<br /> and click Check. (
					<span className="codex-empty-links">
						<a
							className="codex-link"
							href={installUrl}
							target="_blank"
							rel="noreferrer"
						>
							Learn more
						</a>
					</span>
					)
				</div>
				<button
					type="button"
					className="codex-bootstrap-button"
					onClick={onCheckInstall}
					disabled={busy}
				>
					Check
				</button>
			</div>

			{errorMessage ? (
				<div className="codex-bootstrap-error">{errorMessage}</div>
			) : null}
		</div>
	);
}

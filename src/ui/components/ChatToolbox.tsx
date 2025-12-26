import React from "react";
import type { CodexModel, CodexReasoning } from "../../types";

type ChatToolboxProps = {
	model: CodexModel;
	reasoning: CodexReasoning;
	modelOptions: ReadonlyArray<CodexModel>;
	reasoningOptions: ReadonlyArray<CodexReasoning>;
	onModelChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
	onReasoningChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
};

export function ChatToolbox({
	model,
	reasoning,
	modelOptions,
	reasoningOptions,
	onModelChange,
	onReasoningChange,
}: ChatToolboxProps): JSX.Element {
	return (
		<div className="codex-toolbox">
			<div className="codex-toolbox-field">
				<span className="codex-toolbox-label">Model</span>
				<select
					className="codex-toolbox-select"
					value={model}
					onChange={onModelChange}
					aria-label="Model"
				>
					{modelOptions.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			</div>
			<div className="codex-toolbox-field">
				<span className="codex-toolbox-label">Reasoning</span>
				<select
					className="codex-toolbox-select"
					value={reasoning}
					onChange={onReasoningChange}
					aria-label="Reasoning"
				>
					{reasoningOptions.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}

import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { App } from "obsidian";
import type { ThreadEvent } from "@openai/codex-sdk";
import { CODEX_RELEASE_TAG, MAX_MESSAGES } from "../constants";
import type {
	AuthStatus,
	CodexModel,
	CodexReasoning,
	CodexSettings,
	Message,
	NoteReference,
} from "../types";
import { DataStore } from "../data/data-store";
import { createId } from "../utils/ids";
import { getActiveNoteReference } from "../services/note-context";
import { CodexService } from "../services/codex-service";
import { downloadCodexBinary } from "../utils/codex-download";
import { getCodexCandidates } from "../utils/codex-path";
import { buildPrompt } from "../utils/prompt";
import { MODEL_OPTIONS, REASONING_OPTIONS } from "../settings";

const INSTALL_URL = "https://developers.openai.com/codex/cli/";

const SendIcon = (): JSX.Element => (
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path d="M4 12L20 4l-4 16-4.2-6.2L4 12z" fill="currentColor" />
	</svg>
);

const StopIcon = (): JSX.Element => (
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
	</svg>
);

const SettingsIcon = (): JSX.Element => (
	<svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
		<path
			d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51.27.11.56.16.85.16H21a2 2 0 0 1 0 4h-.09c-.29 0-.58.05-.85.16-.61.25-1 .85-1 1.51Z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

type ChatAppProps = {
	app: App;
	dataStore: DataStore;
};

type ErrorKind = "auth" | "not-installed" | "unexpected";

type ClassifiedError = {
	kind: ErrorKind;
	message: string;
};

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

function classifyCodexError(error: unknown): ClassifiedError {
	const message = getErrorMessage(error);
	const normalized = message.toLowerCase();

	if (
		normalized.includes("login") ||
		normalized.includes("not logged in") ||
		normalized.includes("authentication") ||
		normalized.includes("api key") ||
		normalized.includes("auth")
	) {
		return { kind: "auth", message };
	}

	if (
		normalized.includes("codex") &&
		(normalized.includes("not found") ||
			normalized.includes("enoent") ||
			normalized.includes("spawn") ||
			normalized.includes("executable"))
	) {
		return { kind: "not-installed", message };
	}

	return { kind: "unexpected", message };
}

function isAbortError(error: unknown): boolean {
	if (error instanceof DOMException) {
		return error.name === "AbortError";
	}
	if (error instanceof Error) {
		return error.name === "AbortError";
	}
	return false;
}

export function ChatApp({ app, dataStore }: ChatAppProps): JSX.Element {
	const initialChat = dataStore.getActiveChat();
	const [chatList, setChatList] = useState(dataStore.getChats());
	const [activeChatId, setActiveChatId] = useState(initialChat.id);
	const [messages, setMessages] = useState<Message[]>(
		dataStore.getMessages()
	);
	const [settings, setSettings] = useState<CodexSettings>(
		dataStore.getSettings()
	);
	const [contextScope, setContextScope] = useState<"vault" | "current-note">(
		initialChat.contextScope
	);
	const [input, setInput] = useState("");
	const [busy, setBusy] = useState(false);
	const [authChecking, setAuthChecking] = useState(false);
	const [authStatus, setAuthStatus] = useState<AuthStatus>("unknown");
	const [codexInstalled, setCodexInstalled] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
		null
	);
	const [bootstrapBusy, setBootstrapBusy] = useState(false);
	const [bootstrapError, setBootstrapError] = useState<string | null>(null);
	const [bootstrapRefresh, setBootstrapRefresh] = useState(0);
	const [selectedCandidate, setSelectedCandidate] = useState("");
	const [loginUrl, setLoginUrl] = useState<string | null>(null);
	const [loginBusy, setLoginBusy] = useState(false);
	const [loginError, setLoginError] = useState<string | null>(null);

	const transcriptRef = useRef<HTMLDivElement | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const messagesRef = useRef<Message[]>(messages);
	const [usage, setUsage] = useState(initialChat.usage);
	const usageRef = useRef(initialChat.usage);
	const [serviceToken, setServiceToken] = useState(0);

	const service = useMemo(
		() =>
			new CodexService(
				app,
				dataStore.getActiveChat().threadId ?? null,
				settings
			),
		[
			app,
			dataStore,
			serviceToken,
			activeChatId,
			settings.codexPath,
			settings.codexPathMode,
		]
	);

	const pluginRoot = useMemo(
		() => dataStore.getPluginRootPath(),
		[dataStore]
	);
	const codexCandidates = useMemo(
		() => getCodexCandidates(pluginRoot),
		[pluginRoot, bootstrapRefresh]
	);
	const hasCandidates = codexCandidates.length > 0;

	useEffect(() => {
		if (!hasCandidates) {
			if (selectedCandidate) {
				setSelectedCandidate("");
			}
			return;
		}
		if (
			!selectedCandidate ||
			!codexCandidates.some(
				(candidate) => candidate.path === selectedCandidate
			)
		) {
			const [first] = codexCandidates;
			if (first) {
				setSelectedCandidate(first.path);
			}
		}
	}, [codexCandidates, hasCandidates, selectedCandidate]);

	useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	useEffect(() => {
		return dataStore.onSettingsChange((next) => {
			setSettings(next);
		});
	}, [dataStore]);

	useEffect(() => {
		service.updateThreadSettings(settings);
	}, [
		service,
		settings.model,
		settings.reasoning,
		settings.internetAccess,
		settings.webSearch,
	]);

	useEffect(() => {
		if (!transcriptRef.current) {
			return;
		}
		transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
	}, [messages, busy]);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		if (settings.codexPathMode === "unset") {
			setAuthChecking(false);
			setAuthStatus("unknown");
			setCodexInstalled(false);
			setErrorMessage(null);
			return;
		}

		let active = true;
		setAuthChecking(true);

		service
			.checkAuthStatus()
			.then((result) => {
				if (!active) {
					return;
				}
				setAuthStatus(result.authStatus);
				setCodexInstalled(result.codexInstalled);
				setErrorMessage(result.errorMessage);
			})
			.finally(() => {
				if (!active) {
					return;
				}
				setAuthChecking(false);
			});

		return () => {
			active = false;
		};
	}, [service, settings.codexPathMode]);

	const commitMessages = useCallback(
		(updater: (prev: Message[]) => Message[], save: boolean) => {
			const next = updater(messagesRef.current);
			const trimmed =
				next.length > MAX_MESSAGES
					? next.slice(next.length - MAX_MESSAGES)
					: next;
			messagesRef.current = trimmed;
			setMessages(trimmed);
			dataStore.setMessages(trimmed);
			if (save) {
				void dataStore.save();
			}
		},
		[dataStore]
	);

	const handleStop = useCallback(() => {
		if (!busy) {
			return;
		}
		abortRef.current?.abort();
	}, [busy]);

	const handleSend = useCallback(async () => {
		const trimmedInput = input.trim();
		if (!trimmedInput || busy) {
			return;
		}
		if (!codexInstalled || authStatus !== "logged-in" || authChecking) {
			return;
		}

		setBusy(true);
		setErrorMessage(null);

		const userMessage: Message = {
			id: createId("user"),
			role: "user",
			text: trimmedInput,
			ts: Date.now(),
		};

		commitMessages((prev) => [...prev, userMessage], true);
		setInput("");

		const assistantId = createId("assistant");
		setStreamingMessageId(assistantId);

		let noteContext: NoteReference | null = null;
		if (contextScope === "current-note") {
			const noteResult = getActiveNoteReference(app);
			if (!noteResult.ok) {
				const errorMessageText = noteResult.error.message;
				const systemMessage: Message = {
					id: createId("system"),
					role: "system",
					text: errorMessageText,
					ts: Date.now(),
				};
				commitMessages((prev) => [...prev, systemMessage], true);
				setBusy(false);
				return;
			}
			noteContext = noteResult.note;
		}

		const assistantMessage: Message = {
			id: assistantId,
			role: "assistant",
			text: "Thinking...",
			ts: Date.now(),
			meta: noteContext
				? {
						noteName: noteContext.name,
						notePath: noteContext.path,
				  }
				: undefined,
		};

		commitMessages((prev) => [...prev, assistantMessage], true);

		const abortController = new AbortController();
		abortRef.current = abortController;

		let streamError: Error | null = null;

		const onEvent = (event: ThreadEvent) => {
			if (streamError) {
				return;
			}

			if (event.type === "thread.started") {
				console.log("Codex: thread started", event.thread_id);
			}

			if (event.type === "turn.started") {
				console.log("Codex: turn started");
			}

			if (event.type === "turn.failed") {
				console.error("Codex: turn failed", event.error);
				streamError = new Error(event.error.message);
				return;
			}

			if (event.type === "turn.completed") {
				const usage = event.usage;
				const nextUsage = {
					inputTokens:
						usageRef.current.inputTokens + usage.input_tokens,
					cachedInputTokens:
						usageRef.current.cachedInputTokens +
						usage.cached_input_tokens,
					outputTokens:
						usageRef.current.outputTokens + usage.output_tokens,
				};
				usageRef.current = nextUsage;
				setUsage(nextUsage);
				dataStore.updateChatUsage(nextUsage);
				console.log("Codex: turn completed", event.usage);
				return;
			}

			if (event.type === "error") {
				console.error("Codex: stream error", event.message);
				streamError = new Error(event.message);
				return;
			}

			if (
				(event.type === "item.started" ||
					event.type === "item.updated" ||
					event.type === "item.completed") &&
				event.item.type !== "agent_message"
			) {
				console.log(`Codex: ${event.type}`, event.item);
			}

			if (
				(event.type === "item.updated" ||
					event.type === "item.completed") &&
				event.item.type === "agent_message"
			) {
				const nextText = event.item.text || "";
				commitMessages(
					(prev) =>
						prev.map((message) =>
							message.id === assistantId
								? { ...message, text: nextText }
								: message
						),
					false
				);
			}
		};

		try {
			const prompt =
				contextScope === "current-note" && noteContext
					? buildPrompt(trimmedInput, "current-note", noteContext)
					: buildPrompt(trimmedInput, "vault");

			await service.runStreamed(prompt, {
				signal: abortController.signal,
				onThreadStarted: (threadId) => {
					dataStore.setThreadId(threadId);
					void dataStore.save();
				},
				onEvent,
			});

			if (streamError) {
				throw streamError;
			}

			setAuthStatus("logged-in");
			setCodexInstalled(true);
			setErrorMessage(null);
			void dataStore.save();
		} catch (error) {
			console.error("Codex: request failed", error);
			if (abortController.signal.aborted || isAbortError(error)) {
				commitMessages(
					(prev) =>
						prev.map((message) =>
							message.id === assistantId
								? { ...message, text: "Cancelled" }
								: message
						),
					true
				);
				setBusy(false);
				setStreamingMessageId(null);
				return;
			}

			const classified = classifyCodexError(error);
			console.error("Codex: classified error", classified);

			if (classified.kind === "auth") {
				setAuthStatus("not-logged-in");
				commitMessages(
					(prev) =>
						prev.map((message) =>
							message.id === assistantId
								? {
										...message,
										text: "Needs login. Run codex login in terminal.",
								  }
								: message
						),
					true
				);
				setErrorMessage(null);
			} else if (classified.kind === "not-installed") {
				setCodexInstalled(false);
				setErrorMessage(null);
				commitMessages(
					(prev) =>
						prev.map((message) =>
							message.id === assistantId
								? { ...message, text: "Codex unavailable" }
								: message
						),
					true
				);
			} else {
				setErrorMessage(null);
				commitMessages(
					(prev) =>
						prev.map((message) =>
							message.id === assistantId
								? { ...message, text: "Unexpected error" }
								: message
						),
					true
				);
			}
		} finally {
			setBusy(false);
			setStreamingMessageId(null);
			abortRef.current = null;
		}
	}, [
		app,
		authChecking,
		authStatus,
		busy,
		codexInstalled,
		commitMessages,
		contextScope,
		dataStore,
		input,
		service,
	]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key !== "Enter") {
				return;
			}

			if (event.shiftKey) {
				return;
			}

			event.preventDefault();
			void handleSend();
		},
		[handleSend]
	);

	const indicatorState =
		busy || (codexInstalled && authStatus === "logged-in") ? "ok" : "error";
	const showHeaderControls = codexInstalled && authStatus === "logged-in";
	const showBootstrap = settings.codexPathMode === "unset";
	const shouldShowChat = codexInstalled && authStatus === "logged-in";
	const showAuthNotice =
		!showBootstrap && codexInstalled && authStatus === "not-logged-in";
	const showInstallNotice = !showBootstrap && !codexInstalled;
	const showChecking =
		!showBootstrap &&
		authChecking &&
		!busy &&
		!showInstallNotice &&
		!showAuthNotice;
	const showError =
		!showBootstrap &&
		!showInstallNotice &&
		!showAuthNotice &&
		!showChecking &&
		!!errorMessage;
	const showChat =
		!showBootstrap && shouldShowChat && !showChecking && !showError;

	useEffect(() => {
		if (!showChat) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			if (!transcriptRef.current) {
				return;
			}
			transcriptRef.current.scrollTop =
				transcriptRef.current.scrollHeight;
		});
		return () => cancelAnimationFrame(frame);
	}, [showChat, activeChatId]);

	const handleRetry = useCallback(() => {
		if (busy) {
			return;
		}
		setAuthStatus("unknown");
		setCodexInstalled(true);
		setErrorMessage(null);
		setLoginError(null);
		setLoginUrl(null);
		setAuthChecking(true);
		setServiceToken((token) => token + 1);
	}, [busy]);

	const retryDisabled = busy || authChecking;
	const actionDisabled = busy
		? false
		: input.trim().length === 0 || authChecking;
	const actionLabel = busy ? "Stop" : "Send";
	const totalTokens = usage.inputTokens + usage.outputTokens;
	const tokenSummary = `Tokens: ${totalTokens} | in ${usage.inputTokens} | out ${usage.outputTokens} | cache ${usage.cachedInputTokens}`;
	const inputPlaceholder =
		contextScope === "vault"
			? "Ask about your vault..."
			: "Ask about the current note...";

	const handleContextChange = useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>) => {
			const next = event.target.value as "vault" | "current-note";
			setContextScope(next);
			dataStore.updateChatContext(next);
			void dataStore.saveMeta();
		},
		[dataStore]
	);

	const applyCodexSelection = useCallback(
		async (path: string) => {
			setBootstrapError(null);
			dataStore.updateSettings({
				codexPathMode: "custom",
				codexPath: path,
			});
			await dataStore.saveMeta();
			setServiceToken((token) => token + 1);
		},
		[dataStore]
	);

	const handleSaveCandidate = useCallback(async () => {
		if (!selectedCandidate) {
			return;
		}
		setBootstrapBusy(true);
		try {
			await applyCodexSelection(selectedCandidate);
		} catch (error) {
			setBootstrapError(getErrorMessage(error));
		} finally {
			setBootstrapBusy(false);
		}
	}, [applyCodexSelection, selectedCandidate]);

	const handleDownloadCodex = useCallback(async () => {
		if (!pluginRoot) {
			setBootstrapError("Plugin directory is not available.");
			return;
		}
		setBootstrapBusy(true);
		setBootstrapError(null);
		try {
			const result = await downloadCodexBinary(pluginRoot);
			await applyCodexSelection(result.path);
		} catch (error) {
			setBootstrapError(getErrorMessage(error));
		} finally {
			setBootstrapBusy(false);
			setServiceToken((token) => token + 1);
		}
	}, [applyCodexSelection, pluginRoot]);

	const handleBrowserLogin = useCallback(async () => {
		setLoginBusy(true);
		setLoginError(null);
		setLoginUrl(null);
		try {
			const result = await service.startLoginFlow({
				onUrl: (url) => {
					setLoginUrl(url);
					window.open(url, "_blank");
				},
			});
			if (!result.url) {
				setLoginError(
					"Login URL was not detected. Run codex login in your terminal."
				);
			}
		} catch (error) {
			setLoginError(getErrorMessage(error));
		} finally {
			setLoginBusy(false);
			setServiceToken((token) => token + 1);
		}
	}, [service]);

	const handleCheckInstall = useCallback(async () => {
		setBootstrapBusy(true);
		setBootstrapError(null);
		try {
			const candidates = getCodexCandidates(pluginRoot);
			setBootstrapRefresh((value) => value + 1);
			if (candidates.length === 0) {
				setBootstrapError(
					"Codex CLI was not found. Install it and try again."
				);
				return;
			}
			const [first] = candidates;
			if (!first) {
				setBootstrapError(
					"Codex CLI was not found. Install it and try again."
				);
				return;
			}
			setSelectedCandidate(first.path);
			await applyCodexSelection(first.path);
		} catch (error) {
			setBootstrapError(getErrorMessage(error));
		} finally {
			setBootstrapBusy(false);
		}
	}, [applyCodexSelection, pluginRoot]);

	const handleChatChange = useCallback(
		async (event: React.ChangeEvent<HTMLSelectElement>) => {
			if (busy) {
				return;
			}
			const nextChatId = event.target.value;
			if (nextChatId === activeChatId) {
				return;
			}
			const result = await dataStore.switchChat(nextChatId);
			if (!result) {
				return;
			}
			setActiveChatId(result.chat.id);
			setMessages(result.messages);
			messagesRef.current = result.messages;
			setContextScope(result.chat.contextScope);
			setUsage(result.chat.usage);
			usageRef.current = result.chat.usage;
			setStreamingMessageId(null);
			setInput("");
			setChatList(dataStore.getChats());
		},
		[activeChatId, busy, dataStore]
	);

	const handleNewChat = useCallback(async () => {
		if (busy) {
			return;
		}
		const result = await dataStore.createChat();
		setActiveChatId(result.chat.id);
		setMessages(result.messages);
		messagesRef.current = result.messages;
		setContextScope(result.chat.contextScope);
		setUsage(result.chat.usage);
		usageRef.current = result.chat.usage;
		setStreamingMessageId(null);
		setInput("");
		setChatList(dataStore.getChats());
	}, [busy, dataStore]);

	const updateSettings = useCallback(
		(patch: Partial<CodexSettings>) => {
			dataStore.updateSettings(patch);
			void dataStore.saveMeta();
		},
		[dataStore]
	);

	const handleModelChange = useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>) => {
			updateSettings({ model: event.target.value as CodexModel });
		},
		[updateSettings]
	);

	const handleReasoningChange = useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>) => {
			updateSettings({ reasoning: event.target.value as CodexReasoning });
		},
		[updateSettings]
	);

	const handleOpenSettings = useCallback(() => {
		const appAny = app as App & {
			commands?: { executeCommandById?: (id: string) => void };
			setting?: { openTabById?: (id: string) => void };
		};
		appAny.commands?.executeCommandById?.("app:open-settings");
		appAny.setting?.openTabById?.(dataStore.getPluginId());
	}, [app, dataStore]);

	const handleStatusClick = useCallback(() => {
		const usage = usageRef.current;
		const totalTokens = usage.inputTokens + usage.outputTokens;
		console.log("Codex /status", {
			inputTokens: usage.inputTokens,
			cachedInputTokens: usage.cachedInputTokens,
			outputTokens: usage.outputTokens,
			totalTokens,
		});
	}, []);

	return (
		<div className="codex-shell">
			<div className="codex-header">
				<div className="codex-title-wrap">
					{showHeaderControls ? (
						<span
							className={`codex-title-dot codex-title-dot-${indicatorState}`}
							aria-hidden="true"
						/>
					) : null}
					<div className="codex-title">Redstone</div>
				</div>
				{showHeaderControls ? (
					<div className="codex-header-right">
						<div className="codex-chat-controls">
							<select
								className="codex-chat-select"
								value={activeChatId}
								onChange={handleChatChange}
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
								onClick={handleNewChat}
								disabled={busy}
							>
								New chat
							</button>
							<button
								type="button"
								className="codex-chat-settings"
								onClick={handleOpenSettings}
								aria-label="Open settings"
							>
								<SettingsIcon />
							</button>
						</div>
						<div className="codex-header-meta">{tokenSummary}</div>
					</div>
				) : null}
			</div>

			{showBootstrap ? (
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
									onChange={(event) =>
										setSelectedCandidate(event.target.value)
									}
									disabled={bootstrapBusy}
									aria-label="Detected Codex CLI"
								>
									{codexCandidates.map((candidate) => (
										<option
											key={candidate.path}
											value={candidate.path}
										>
											{candidate.label}
										</option>
									))}
								</select>
								<button
									type="button"
									className="codex-bootstrap-button"
									onClick={handleSaveCandidate}
									disabled={
										bootstrapBusy || !selectedCandidate
									}
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
							onClick={handleDownloadCodex}
							disabled={bootstrapBusy || !pluginRoot}
						>
							Download
						</button>
					</div>

					<div className="codex-bootstrap-section">
						<div className="codex-bootstrap-label">
							Option 3: Install manually
						</div>
						<div className="codex-bootstrap-text">
							Run <br/><code><b>npm install -g @openai/codex</b></code>
							<br/> and click Check. (<span className="codex-empty-links">
								<a
									className="codex-link"
									href={INSTALL_URL}
									target="_blank"
									rel="noreferrer"
								>
									Learn more
								</a>
							</span>)
					
						</div>
						<button
							type="button"
							className="codex-bootstrap-button"
							onClick={handleCheckInstall}
							disabled={bootstrapBusy}
						>
							Check
						</button>
					</div>

					{bootstrapError ? (
						<div className="codex-bootstrap-error">
							{bootstrapError}
						</div>
					) : null}
				</div>
			) : null}

			{showInstallNotice ? (
				<div className="codex-empty-state">
					<div className="codex-empty-title">
						Codex is not installed
					</div>
					<div className="codex-empty-text">
						Install it with{" "}
						<code>npm install -g @openai/codex</code>.
					</div>
					<div className="codex-empty-links">
						<a
							className="codex-link"
							href={INSTALL_URL}
							target="_blank"
							rel="noreferrer"
						>
							Learn more
						</a>
					</div>
					<button
						type="button"
						className="codex-retry"
						onClick={handleRetry}
						disabled={retryDisabled}
					>
						Retry
					</button>
				</div>
			) : null}

			{showAuthNotice ? (
				<div className="codex-empty-state">
					<div className="codex-empty-title">Login to Codex CLI</div>
					<div className="codex-auth-actions">
						<button
							type="button"
							className="codex-auth-button"
							onClick={handleBrowserLogin}
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
						Or run <code>codex</code> in your terminal to sign in and click button below.
					</div>
					<button
						type="button"
						className="codex-retry"
						onClick={handleRetry}
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
			) : null}

			{showChecking ? (
				<div className="codex-empty-state">
					<div className="codex-empty-title">
						Checking Codex status
					</div>
					<div className="codex-empty-text">
						Hold on while we verify your setup.
					</div>
				</div>
			) : null}

			{showError ? (
				<div className="codex-empty-state">
					<div className="codex-empty-title">Unexpected error</div>
					<div className="codex-empty-text">
						{errorMessage ?? "Something went wrong."}
					</div>
					<button
						type="button"
						className="codex-retry"
						onClick={handleRetry}
						disabled={retryDisabled}
					>
						Retry
					</button>
				</div>
			) : null}

			{showChat ? (
				<>
					<div className="codex-transcript" ref={transcriptRef}>
						{messages.length === 0 ? (
							<div className="codex-empty">
								{contextScope === "vault"
									? "Ask a question about your vault."
									: "Ask a question about the active note."}
							</div>
						) : (
							messages.map((message) => {
								const isStreaming =
									message.id === streamingMessageId;

								return (
									<div
										key={message.id}
										className={`codex-message codex-message-${
											message.role
										} ${
											isStreaming
												? "codex-message-streaming"
												: ""
										}`}
									>
										<div className="codex-message-text">
											{message.text}
										</div>
									</div>
								);
							})
						)}
					</div>

					<div className="codex-input">
						<textarea
							className="codex-textarea"
							placeholder={inputPlaceholder}
							value={input}
							onChange={(event) => setInput(event.target.value)}
							onKeyDown={handleKeyDown}
							disabled={busy}
							rows={3}
						/>
						<div className="codex-input-actions">
							<div className="codex-toolbox-field">
								<span className="codex-toolbox-label">
									Context
								</span>
								<select
									className="codex-toolbox-select"
									value={contextScope}
									onChange={handleContextChange}
									disabled={busy}
									aria-label="Context"
								>
									<option value="vault">Vault</option>
									<option value="current-note">
										Current note
									</option>
								</select>
							</div>
							<button
								type="button"
								className={`codex-action ${
									busy ? "codex-action-stop" : ""
								}`}
								onClick={() =>
									busy ? handleStop() : void handleSend()
								}
								disabled={actionDisabled}
								aria-label={actionLabel}
							>
								{busy ? <StopIcon /> : <SendIcon />}
							</button>
						</div>
					</div>
					<div className="codex-toolbox">
						<div className="codex-toolbox-field">
							<span className="codex-toolbox-label">Model</span>
							<select
								className="codex-toolbox-select"
								value={settings.model}
								onChange={handleModelChange}
								aria-label="Model"
							>
								{MODEL_OPTIONS.map((model) => (
									<option key={model} value={model}>
										{model}
									</option>
								))}
							</select>
						</div>
						<div className="codex-toolbox-field">
							<span className="codex-toolbox-label">
								Reasoning
							</span>
							<select
								className="codex-toolbox-select"
								value={settings.reasoning}
								onChange={handleReasoningChange}
								aria-label="Reasoning"
							>
								{REASONING_OPTIONS.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</div>
						{/* <button
							type="button"
							className="codex-toolbox-button"
							onClick={handleStatusClick}
						>
							/status
						</button> */}
					</div>
				</>
			) : null}
		</div>
	);
}

import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { App } from "obsidian";
import type { ThreadEvent } from "@openai/codex-sdk";
import { MAX_MESSAGES } from "../constants";
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
import { ChatHeader } from "./components/ChatHeader";
import { BootstrapPanel } from "./components/BootstrapPanel";
import { AuthNotice } from "./components/AuthNotice";
import { CheckingNotice } from "./components/CheckingNotice";
import { ErrorNotice } from "./components/ErrorNotice";
import { ChatTranscript } from "./components/ChatTranscript";
import { ChatInput } from "./components/ChatInput";
import { ChatToolbox } from "./components/ChatToolbox";

const INSTALL_URL = "https://developers.openai.com/codex/cli/";

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

	const transcriptRef = useRef<HTMLDivElement>(null);
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
	const showBootstrap =
		settings.codexPathMode === "unset" || !codexInstalled;
	const shouldShowChat = codexInstalled && authStatus === "logged-in";
	const showAuthNotice =
		!showBootstrap && codexInstalled && authStatus === "not-logged-in";
	const showChecking =
		!showBootstrap &&
		authChecking &&
		!busy &&
		!showAuthNotice;
	const showError =
		!showBootstrap &&
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

	return (
		<div className="codex-shell">
			<ChatHeader
				title="Redstone"
				showIndicator={showHeaderControls}
				indicatorState={indicatorState}
				showControls={showHeaderControls}
				activeChatId={activeChatId}
				chatList={chatList}
				busy={busy}
				onChatChange={handleChatChange}
				onNewChat={handleNewChat}
				onOpenSettings={handleOpenSettings}
				tokenSummary={tokenSummary}
			/>

			<BootstrapPanel
				visible={showBootstrap}
				candidates={codexCandidates}
				selectedCandidate={selectedCandidate}
				onSelectCandidate={(value) => setSelectedCandidate(value)}
				onSaveCandidate={handleSaveCandidate}
				onDownload={handleDownloadCodex}
				onCheckInstall={handleCheckInstall}
				busy={bootstrapBusy}
				errorMessage={bootstrapError}
				pluginRootAvailable={!!pluginRoot}
				installUrl={INSTALL_URL}
			/>


			<AuthNotice
				visible={showAuthNotice}
				loginUrl={loginUrl}
				loginBusy={loginBusy}
				retryDisabled={retryDisabled}
				loginError={loginError}
				onAuthorize={handleBrowserLogin}
				onCheck={handleRetry}
			/>

			<CheckingNotice visible={showChecking} />

			<ErrorNotice
				visible={showError}
				errorMessage={errorMessage}
				onRetry={handleRetry}
				retryDisabled={retryDisabled}
			/>

			{showChat ? (
				<>
					<ChatTranscript
						ref={transcriptRef}
						messages={messages}
						contextScope={contextScope}
						streamingMessageId={streamingMessageId}
					/>
					<ChatInput
						input={input}
						placeholder={inputPlaceholder}
						busy={busy}
						actionLabel={actionLabel}
						actionDisabled={actionDisabled}
						contextScope={contextScope}
						onInputChange={(value) => setInput(value)}
						onKeyDown={handleKeyDown}
						onContextChange={handleContextChange}
						onSend={() => void handleSend()}
						onStop={handleStop}
					/>
					<ChatToolbox
						model={settings.model}
						reasoning={settings.reasoning}
						modelOptions={MODEL_OPTIONS}
						reasoningOptions={REASONING_OPTIONS}
						onModelChange={handleModelChange}
						onReasoningChange={handleReasoningChange}
					/>
				</>
			) : null}
		</div>
	);
}

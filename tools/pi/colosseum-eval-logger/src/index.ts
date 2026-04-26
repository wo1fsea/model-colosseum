import type { AssistantMessage, Usage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

type JsonObject = Record<string, unknown>;

interface EvalRecord {
	version: 1;
	type: "turn";
	timestamp: string;
	taskId: string | null;
	runId: string;
	sessionId: string;
	sessionFile: string | null;
	turnIndex: number;
	turnId: string;
	provider: string | null;
	model: string | null;
	api: string | null;
	responseId: string | null;
	stopReason: string | null;
	usage: {
		input: number | null;
		output: number | null;
		cacheRead: number | null;
		cacheWrite: number | null;
		totalTokens: number | null;
		cost: {
			input: number | null;
			output: number | null;
			cacheRead: number | null;
			cacheWrite: number | null;
			total: number | null;
		};
	};
	durationMs: number | null;
	cwd: string;
	git: {
		commit: string | null;
		dirty: boolean | null;
	};
	toolResults: {
		total: number;
		errors: number;
	};
	assistantTextChars: number;
	meta: unknown;
}

const EXTENSION_NAME = "colosseum-eval-logger";
const DEFAULT_TASK_ID = "manual";

function env(name: string): string | undefined {
	const value = process.env[name];
	return value && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveLogPath(cwd: string): string {
	const configured = env("COLOSSEUM_LOG_PATH");
	if (!configured) return join(cwd, ".colosseum", "runs.jsonl");
	return isAbsolute(configured) ? configured : join(cwd, configured);
}

function resolveTaskId(): string | null {
	return env("COLOSSEUM_TASK_ID") ?? env("APEX_TASK_ID") ?? DEFAULT_TASK_ID;
}

function resolveRunId(ctx: ExtensionContext): string {
	return (
		env("COLOSSEUM_RUN_ID") ??
		env("APEX_RUN_ID") ??
		`${resolveTaskId() ?? DEFAULT_TASK_ID}-${ctx.sessionManager.getSessionId()}`
	);
}

function resolveMeta(): unknown {
	const raw = env("COLOSSEUM_META");
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
}

function isAssistantMessage(message: unknown): message is AssistantMessage {
	return (
		typeof message === "object" &&
		message !== null &&
		"role" in message &&
		(message as { role?: unknown }).role === "assistant"
	);
}

function nullableNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeUsage(usage: Usage | undefined): EvalRecord["usage"] {
	return {
		input: nullableNumber(usage?.input),
		output: nullableNumber(usage?.output),
		cacheRead: nullableNumber(usage?.cacheRead),
		cacheWrite: nullableNumber(usage?.cacheWrite),
		totalTokens: nullableNumber(usage?.totalTokens),
		cost: {
			input: nullableNumber(usage?.cost?.input),
			output: nullableNumber(usage?.cost?.output),
			cacheRead: nullableNumber(usage?.cost?.cacheRead),
			cacheWrite: nullableNumber(usage?.cost?.cacheWrite),
			total: nullableNumber(usage?.cost?.total),
		},
	};
}

function assistantTextChars(message: AssistantMessage): number {
	return message.content
		.filter((part): part is { type: "text"; text: string } => part.type === "text")
		.reduce((sum, part) => sum + part.text.length, 0);
}

function runGit(args: string[], cwd: string): string | null {
	try {
		return execFileSync("git", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}

function gitInfo(cwd: string): EvalRecord["git"] {
	const commit = runGit(["rev-parse", "--short", "HEAD"], cwd);
	if (!commit) return { commit: null, dirty: null };

	const status = runGit(["status", "--porcelain"], cwd);
	return {
		commit,
		dirty: status === null ? null : status.length > 0,
	};
}

function appendJsonl(filePath: string, record: JsonObject): void {
	mkdirSync(dirname(filePath), { recursive: true });
	appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

function formatNumber(value: number): string {
	return Math.round(value).toLocaleString();
}

function readRecords(filePath: string): EvalRecord[] {
	if (!existsSync(filePath)) return [];
	return readFileSync(filePath, "utf8")
		.split(/\r?\n/)
		.filter((line) => line.trim().length > 0)
		.map((line) => {
			try {
				return JSON.parse(line) as EvalRecord;
			} catch {
				return null;
			}
		})
		.filter((record): record is EvalRecord => record !== null && record.type === "turn");
}

function summarize(records: EvalRecord[]): string {
	if (records.length === 0) return "No Model Colosseum records found yet.";

	const byModel = new Map<
		string,
		{ turns: number; input: number; output: number; cacheRead: number; cacheWrite: number; cost: number; duration: number }
	>();

	for (const record of records) {
		const key = `${record.provider ?? "unknown"}/${record.model ?? "unknown"}`;
		const current =
			byModel.get(key) ?? { turns: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, duration: 0 };
		current.turns += 1;
		current.input += record.usage.input ?? 0;
		current.output += record.usage.output ?? 0;
		current.cacheRead += record.usage.cacheRead ?? 0;
		current.cacheWrite += record.usage.cacheWrite ?? 0;
		current.cost += record.usage.cost.total ?? 0;
		current.duration += record.durationMs ?? 0;
		byModel.set(key, current);
	}

	const lines = [
		"Model Colosseum Stats",
		"",
		"model | turns | input | output | cache | cost | duration",
		"--- | ---: | ---: | ---: | ---: | ---: | ---:",
	];
	for (const [model, stats] of [...byModel.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		const cache = stats.cacheRead + stats.cacheWrite;
		const seconds = stats.duration > 0 ? `${(stats.duration / 1000).toFixed(1)}s` : "-";
		lines.push(
			`${model} | ${stats.turns} | ${formatNumber(stats.input)} | ${formatNumber(stats.output)} | ${formatNumber(cache)} | $${stats.cost.toFixed(4)} | ${seconds}`,
		);
	}
	return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
	const turnStarts = new Map<number, number>();

	pi.on("turn_start", async (event) => {
		turnStarts.set(event.turnIndex, event.timestamp);
	});

	pi.on("turn_end", async (event, ctx) => {
		if (!isAssistantMessage(event.message)) return;

		const logPath = resolveLogPath(ctx.cwd);
		const start = turnStarts.get(event.turnIndex);
		const provider = event.message.provider ?? ctx.model?.provider ?? null;
		const model = event.message.model ?? ctx.model?.id ?? null;
		const sessionId = ctx.sessionManager.getSessionId();
		const toolErrors = event.toolResults.filter((result) => result.isError).length;

		const record: EvalRecord = {
			version: 1,
			type: "turn",
			timestamp: new Date().toISOString(),
			taskId: resolveTaskId(),
			runId: resolveRunId(ctx),
			sessionId,
			sessionFile: ctx.sessionManager.getSessionFile() ?? null,
			turnIndex: event.turnIndex,
			turnId: `${sessionId}:${event.turnIndex}`,
			provider,
			model,
			api: event.message.api ?? null,
			responseId: event.message.responseId ?? null,
			stopReason: event.message.stopReason ?? null,
			usage: normalizeUsage(event.message.usage),
			durationMs: typeof start === "number" ? Date.now() - start : null,
			cwd: ctx.cwd,
			git: gitInfo(ctx.cwd),
			toolResults: {
				total: event.toolResults.length,
				errors: toolErrors,
			},
			assistantTextChars: assistantTextChars(event.message),
			meta: resolveMeta(),
		};

		appendJsonl(logPath, record as unknown as JsonObject);
		turnStarts.delete(event.turnIndex);

		if (ctx.hasUI) {
			ctx.ui.setStatus(EXTENSION_NAME, `logged ${provider ?? "unknown"}/${model ?? "unknown"}`);
		}
	});

	pi.registerCommand("colosseum-stats", {
		description: "Show Model Colosseum token and run summary",
		handler: async (_args, ctx) => {
			const logPath = resolveLogPath(ctx.cwd);
			const summary = summarize(readRecords(logPath));
			if (ctx.hasUI) {
				ctx.ui.setWidget(EXTENSION_NAME, [summary, "", logPath]);
				ctx.ui.notify("Model Colosseum stats updated", "info");
			} else {
				console.log(summary);
			}
		},
	});
}

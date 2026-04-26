#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const worktreeRoot = resolve(repoRoot, "..", "model-colosseum-worktrees");
const attempt = process.env.COLOSSEUM_ATTEMPT ?? "a01";
const thinking = process.env.COLOSSEUM_THINKING ?? "high";

const tasks = [
	{ id: "json-patch-engine", fixture: "fixtures/json-patch-engine", expectedTests: 8 },
	{ id: "config-migration", fixture: "fixtures/config-migration", expectedTests: 10 },
	{ id: "flaky-triage", fixture: "fixtures/flaky-triage", expectedTests: 5 },
];

const models = [
	{ id: "xiaomi/mimo-v2-pro", slug: "xiaomi-mimo-v2-pro" },
	{ id: "z-ai/glm-5.1", slug: "z-ai-glm-5.1" },
	{ id: "moonshotai/kimi-k2.6", slug: "moonshotai-kimi-k2.6" },
	{ id: "minimax/minimax-m2.7", slug: "minimax-minimax-m2.7" },
];

const startedAt = new Date().toISOString();

function runId(task, model) {
	return `${task.id}__pi__openrouter__${model.slug}-${thinking}__${attempt}`;
}

function branchName(task, model) {
	return `runs/${task.id}/pi-openrouter-${model.slug}-${thinking}/${attempt}`;
}

function worktreePath(task, model) {
	return join(worktreeRoot, runId(task, model));
}

function logPrefix(model, task) {
	return `[${model.slug} ${task.id}]`;
}

function ensureDir(path) {
	mkdirSync(path, { recursive: true });
}

function runCommand(command, args, options = {}) {
	return new Promise((resolvePromise) => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? repoRoot,
			env: options.env ?? process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			const text = chunk.toString();
			stdout += text;
			options.onStdout?.(text);
		});
		child.stderr.on("data", (chunk) => {
			const text = chunk.toString();
			stderr += text;
			options.onStderr?.(text);
		});
		child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout, stderr }));
		child.on("error", (error) => resolvePromise({ code: 1, stdout, stderr: `${stderr}${error.message}\n` }));
	});
}

async function git(args, cwd = repoRoot) {
	return runCommand("git", args, { cwd });
}

function parseJsonl(path) {
	if (!existsSync(path)) return [];
	return readFileSync(path, "utf8")
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			try {
				return JSON.parse(line);
			} catch {
				return null;
			}
		})
		.filter(Boolean);
}

function sum(records, pathParts) {
	return records.reduce((total, record) => {
		let value = record;
		for (const part of pathParts) value = value?.[part];
		return total + (typeof value === "number" ? value : 0);
	}, 0);
}

function extractPassCount(testOutput) {
	const match = testOutput.match(/ℹ pass (\d+)/);
	return match ? Number(match[1]) : null;
}

function resultDir(task, model) {
	return join(repoRoot, "results", task.id, runId(task, model));
}

function writeRunResults(run) {
	const outDir = resultDir(run.task, run.model);
	ensureDir(join(outDir, "logs"));

	const piLogPath = join(run.worktree, ".colosseum", "runs.jsonl");
	const piRecords = parseJsonl(piLogPath).filter((record) => record.runId === run.runId);
	const piJsonl = piRecords.map((record) => JSON.stringify(record)).join("\n");
	writeFileSync(join(outDir, "logs", "pi-runs.jsonl"), piJsonl ? `${piJsonl}\n` : "");
	writeFileSync(join(outDir, "logs", "pi-output.txt"), run.piOutput);
	writeFileSync(join(outDir, "logs", "test-output.txt"), run.testOutput);

	const diff = run.diff;
	writeFileSync(join(outDir, "diff.patch"), diff);

	const passed = run.testCode === 0;
	const score = passed ? 100 : 0;
	const metrics = {
		task_id: run.task.id,
		run_id: run.runId,
		branch: run.branch,
		commit: run.commit,
		agent: "pi",
		provider: "openrouter",
		model: run.model.id,
		thinking,
		attempt,
		timestamps: {
			started: piRecords[0]?.timestamp ?? run.started,
			finished: piRecords.at(-1)?.timestamp ?? run.finished,
		},
		tokens: {
			input: sum(piRecords, ["usage", "input"]),
			output: sum(piRecords, ["usage", "output"]),
			cache_read: sum(piRecords, ["usage", "cacheRead"]),
			cache_write: sum(piRecords, ["usage", "cacheWrite"]),
			total: sum(piRecords, ["usage", "totalTokens"]),
		},
		cost: {
			estimated_usd: Number(sum(piRecords, ["usage", "cost", "total"]).toFixed(6)),
			billed_usd: null,
			source: "pi usage estimate; OpenRouter dashboard not queried by this script",
		},
		runtime: {
			duration_ms: sum(piRecords, ["durationMs"]),
		},
		tests: [
			{
				command: "npm test",
				cwd: run.task.fixture,
				status: passed ? "passed" : "failed",
				passed: extractPassCount(run.testOutput),
				expected: run.task.expectedTests,
				notes: "Verified by runner after Pi run.",
			},
		],
		scores: {
			tests_pass: passed ? 40 : 0,
			behavioral_correctness: passed ? 25 : 0,
			code_quality: passed ? 15 : 0,
			agent_process: run.piCode === 0 ? 10 : 0,
			cost: passed ? 5 : 0,
			runtime: passed ? 5 : 0,
			total: score,
		},
	};
	writeFileSync(join(outDir, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);

	const shortCommit = run.commit ? run.commit.slice(0, 7) : "n/a";
	writeFileSync(
		join(outDir, "run.md"),
		`# ${run.runId}

## Metadata

- task id: \`${run.task.id}\`
- run id: \`${run.runId}\`
- branch: \`${run.branch}\`
- commit: \`${shortCommit}\`
- agent: \`pi\`
- provider: \`openrouter\`
- model: \`${run.model.id}\`
- thinking: \`${thinking}\`
- attempt: \`${attempt}\`
- started: ${metrics.timestamps.started || "n/a"}
- finished: ${metrics.timestamps.finished || "n/a"}

## Prompt

- [Task prompt](../../../tasks/${run.task.id}/task.md)

## Commands

\`\`\`text
COLOSSEUM_TASK_ID=${run.task.id} COLOSSEUM_RUN_ID=${run.runId} pi --provider openrouter --model ${run.model.id} --thinking ${thinking} -p "$(cat tasks/${run.task.id}/task.md)"
cd ${run.task.fixture} && npm test
\`\`\`

## Artifacts

- diff: [diff.patch](diff.patch)
- metrics: [metrics.json](metrics.json)
- evaluation: [evaluation.md](evaluation.md)
- Pi log: [logs/pi-runs.jsonl](logs/pi-runs.jsonl)
- Pi output: [logs/pi-output.txt](logs/pi-output.txt)
- Test output: [logs/test-output.txt](logs/test-output.txt)

## Notes

- Pi exit code: ${run.piCode}
- Test exit code: ${run.testCode}
`,
	);

	writeFileSync(
		join(outDir, "evaluation.md"),
		`# Evaluation

## Score

| Dimension | Weight | Score | Notes |
|---|---:|---:|---|
| Tests pass | 40 | ${metrics.scores.tests_pass} | \`npm test\` ${passed ? "passed" : "failed"}. |
| Behavioral correctness | 25 | ${metrics.scores.behavioral_correctness} | ${passed ? "Visible task requirements are covered by the fixture tests." : "Not awarded because tests failed."} |
| Code quality and maintainability | 15 | ${metrics.scores.code_quality} | ${passed ? "Automated baseline score; human diff review still recommended." : "Not awarded because tests failed."} |
| Agent process quality | 10 | ${metrics.scores.agent_process} | Pi process ${run.piCode === 0 ? "completed" : "failed"} and produced a final response/log. |
| Cost | 5 | ${metrics.scores.cost} | Estimated cost recorded for comparison. |
| Runtime | 5 | ${metrics.scores.runtime} | Runtime recorded for comparison. |
| Total | 100 | ${metrics.scores.total} |  |

## Findings

- ${passed ? "No blocking issue found by automated tests." : "Run did not pass the required tests."}
- Human qualitative review is still recommended before treating this as a final leaderboard score.

## Test Results

- \`npm test\` in \`${run.task.fixture}\`: ${passed ? "passed" : "failed"}.

## Cost And Runtime

- Input tokens: ${metrics.tokens.input.toLocaleString()}
- Output tokens: ${metrics.tokens.output.toLocaleString()}
- Cache read tokens: ${metrics.tokens.cache_read.toLocaleString()}
- Estimated cost: $${metrics.cost.estimated_usd.toFixed(6)}
- Recorded turn duration: ${(metrics.runtime.duration_ms / 1000).toFixed(1)}s

## Verdict

- ${passed ? "Accepted as an automated passing run." : "Needs follow-up; tests failed."}
`,
	);
}

async function updateLeaderboards() {
	const { readdirSync } = await import("node:fs");
	for (const task of tasks) {
		const taskDir = join(repoRoot, "results", task.id);
		ensureDir(taskDir);
		const metrics = readdirSync(taskDir)
			.map((entry) => join(taskDir, entry, "metrics.json"))
			.filter((file) => existsSync(file))
			.map((file) => JSON.parse(readFileSync(file, "utf8")));
		metrics.sort((a, b) => {
			if ((b.scores?.total ?? 0) !== (a.scores?.total ?? 0)) return (b.scores?.total ?? 0) - (a.scores?.total ?? 0);
			return (a.cost?.estimated_usd ?? 0) - (b.cost?.estimated_usd ?? 0);
		});
		const lines = [
			"# Leaderboard",
			"",
			"| Run | Model | Tests | Score | Estimated Cost | Duration |",
			"|---|---|---:|---:|---:|---:|",
		];
		for (const item of metrics) {
			const test = item.tests?.[0];
			const duration = item.runtime?.duration_ms ? `${(item.runtime.duration_ms / 1000).toFixed(1)}s` : "-";
			lines.push(
				`| [${item.run_id}](${item.run_id}/run.md) | ${item.provider}/${item.model} (${item.thinking ?? "n/a"}) | ${test?.status ?? "unknown"} | ${item.scores?.total ?? 0} | $${Number(item.cost?.estimated_usd ?? 0).toFixed(6)} | ${duration} |`,
			);
		}
		writeFileSync(join(taskDir, "leaderboard.md"), `${lines.join("\n")}\n`);
	}
}

async function prepareRun(task, model) {
	const branch = branchName(task, model);
	const wt = worktreePath(task, model);
	if (existsSync(wt)) {
		throw new Error(`Worktree already exists: ${wt}`);
	}
	ensureDir(dirname(wt));
	const existingBranch = await git(["rev-parse", "--verify", branch]);
	if (existingBranch.code === 0) {
		throw new Error(`Branch already exists: ${branch}`);
	}
	const add = await git(["worktree", "add", "-b", branch, wt, "main"]);
	if (add.code !== 0) throw new Error(add.stderr || add.stdout);
	return { branch, worktree: wt };
}

async function runOne(task, model) {
	const id = runId(task, model);
	const prefix = logPrefix(model, task);
	const started = new Date().toISOString();
	console.log(`${prefix} preparing ${id}`);
	const { branch, worktree } = await prepareRun(task, model);
	const prompt = readFileSync(join(worktree, "tasks", task.id, "task.md"), "utf8");
	const env = {
		...process.env,
		COLOSSEUM_TASK_ID: task.id,
		COLOSSEUM_RUN_ID: id,
		COLOSSEUM_META: JSON.stringify({
			agent: "pi",
			provider: "openrouter",
			model: model.id,
			thinking,
			attempt,
		}),
	};

	const pi = await runCommand("pi", ["--provider", "openrouter", "--model", model.id, "--thinking", thinking, "-p", prompt], {
		cwd: worktree,
		env,
		onStdout: (text) => process.stdout.write(`${prefix} ${text}`),
		onStderr: (text) => process.stderr.write(`${prefix} ${text}`),
	});

	const test = await runCommand("npm", ["test"], {
		cwd: join(worktree, task.fixture),
		onStdout: (text) => process.stdout.write(`${prefix} ${text}`),
		onStderr: (text) => process.stderr.write(`${prefix} ${text}`),
	});

	const status = await git(["status", "--short"], worktree);
	if (status.stdout.trim()) {
		await git(["add", "-A"], worktree);
		const commit = await git(["commit", "-m", `Run pi openrouter ${model.id} ${thinking} on ${task.id}`], worktree);
		if (commit.code !== 0) console.error(`${prefix} commit failed\n${commit.stderr || commit.stdout}`);
	} else {
		console.warn(`${prefix} no changes to commit`);
	}

	const commitSha = (await git(["rev-parse", "HEAD"], worktree)).stdout.trim();
	const push = await git(["push", "-u", "origin", branch], worktree);
	if (push.code !== 0) console.error(`${prefix} push failed\n${push.stderr || push.stdout}`);
	const diff = (await git(["diff", "--binary", `main...${branch}`])).stdout;

	const run = {
		task,
		model,
		runId: id,
		branch,
		worktree,
		started,
		finished: new Date().toISOString(),
		piCode: pi.code,
		piOutput: `${pi.stdout}${pi.stderr ? `\n--- stderr ---\n${pi.stderr}` : ""}`,
		testCode: test.code,
		testOutput: `${test.stdout}${test.stderr ? `\n--- stderr ---\n${test.stderr}` : ""}`,
		commit: commitSha,
		diff,
	};
	writeRunResults(run);
	console.log(`${prefix} done pi=${pi.code} test=${test.code} commit=${commitSha.slice(0, 7)}`);
	return run;
}

async function runModel(model) {
	const results = [];
	for (const task of tasks) {
		results.push(await runOne(task, model));
	}
	return results;
}

async function main() {
	console.log(`Model Colosseum OpenRouter flagship run started ${startedAt}`);
	console.log(`Models: ${models.map((m) => m.id).join(", ")}`);
	console.log(`Tasks: ${tasks.map((t) => t.id).join(", ")}`);
	console.log(`Thinking: ${thinking}`);

	const runs = (await Promise.all(models.map((model) => runModel(model)))).flat();
	await updateLeaderboards();
	const add = await git(["add", "results"]);
	if (add.code !== 0) throw new Error(add.stderr || add.stdout);
	const commit = await git(["commit", "-m", `Record pi openrouter flagship ${thinking} runs`]);
	if (commit.code !== 0) {
		console.warn(`main results commit skipped or failed:\n${commit.stderr || commit.stdout}`);
	}
	const push = await git(["push"]);
	if (push.code !== 0) {
		console.warn(`main push failed:\n${push.stderr || push.stdout}`);
	}

	const failed = runs.filter((run) => run.piCode !== 0 || run.testCode !== 0);
	console.log(`Completed ${runs.length} runs, failures=${failed.length}`);
	for (const run of runs) {
		console.log(`${run.runId}: pi=${run.piCode} test=${run.testCode} commit=${run.commit.slice(0, 7)}`);
	}
	if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

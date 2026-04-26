#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const externalWorktreeRoot = "/Users/huangquanyong/Projects/model-colosseum-worktrees";
const includeModels = new Set([
	"gpt-5.5",
	"xiaomi/mimo-v2-pro",
	"z-ai/glm-5.1",
	"moonshotai/kimi-k2.6",
	"minimax/minimax-m2.7",
]);

const metrics = discoverMetrics().filter((metric) => includeModels.has(metric.model));
const tempDirs = [];

try {
	const rows = [];
	for (const metric of metrics) {
		const sourceRoot = await resolveSourceRoot(metric);
		const hidden = await runHiddenTests(metric, sourceRoot);
		rows.push({
			taskId: metric.task_id,
			runId: metric.run_id,
			provider: metric.provider,
			model: metric.model,
			commit: metric.commit.slice(0, 7),
			estimatedCost: metric.cost?.estimated_usd ?? null,
			durationMs: metric.runtime?.duration_ms ?? null,
			original: {
				status: metric.tests?.[0]?.status ?? "unknown",
				passed: metric.tests?.[0]?.passed ?? null,
				expected: metric.tests?.[0]?.expected ?? metric.tests?.[0]?.passed ?? null,
			},
			hidden,
		});
	}

	rows.sort(compareRows);
	const outputDir = path.join(repoRoot, "results", "comparative-evaluation");
	await mkdir(outputDir, { recursive: true });
	await writeFile(path.join(outputDir, "hidden-tests.json"), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
	await writeFile(path.join(outputDir, "hidden-tests.md"), renderMarkdown(rows), "utf8");
	console.log(renderConsole(rows));
} finally {
	for (const dir of tempDirs) {
		await rm(dir, { recursive: true, force: true });
	}
}

function discoverMetrics() {
	const output = execFileSync("find", ["results", "-name", "metrics.json"], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	return output
		.trim()
		.split("\n")
		.filter(Boolean)
		.filter((file) => !file.includes("/_template/"))
		.map((file) => JSON.parse(execFileSync("cat", [file], { cwd: repoRoot, encoding: "utf8" })));
}

async function resolveSourceRoot(metric) {
	const external = path.join(externalWorktreeRoot, metric.run_id);
	if (existsSync(external)) return external;

	const temp = mkdtempSync(path.join(tmpdir(), `model-colosseum-${metric.run_id}-`));
	tempDirs.push(temp);
	const archive = spawnSync("git", ["archive", metric.commit], { cwd: repoRoot, encoding: "buffer" });
	if (archive.status !== 0) {
		throw new Error(`git archive failed for ${metric.run_id}: ${archive.stderr.toString()}`);
	}
	const tar = spawnSync("tar", ["-x", "-C", temp], { input: archive.stdout, encoding: "buffer" });
	if (tar.status !== 0) {
		throw new Error(`tar extract failed for ${metric.run_id}: ${tar.stderr.toString()}`);
	}
	return temp;
}

async function runHiddenTests(metric, sourceRoot) {
	const testsByTask = {
		"json-patch-engine": runJsonPatchHiddenTests,
		"config-migration": runConfigHiddenTests,
		"flaky-triage": runFlakyHiddenTests,
	};
	const testFn = testsByTask[metric.task_id];
	if (!testFn) throw new Error(`No hidden tests for ${metric.task_id}`);
	const cases = await testFn(sourceRoot);
	return {
		passed: cases.filter((testCase) => testCase.ok).length,
		total: cases.length,
		cases,
	};
}

async function runCase(name, fn) {
	try {
		await fn();
		return { name, ok: true };
	} catch (error) {
		return {
			name,
			ok: false,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}

async function importModule(file) {
	return import(`${pathToFileURL(file).href}?eval=${Date.now()}-${Math.random()}`);
}

async function runJsonPatchHiddenTests(sourceRoot) {
	const { applyPatch, JsonPatchError } = await importModule(
		path.join(sourceRoot, "fixtures/json-patch-engine/src/index.ts"),
	);

	return [
		await runCase("replace must fail when object key is missing", () => {
			assert.throws(
				() => applyPatch({ user: { name: "Ada" } }, [{ op: "replace", path: "/user/missing", value: true }]),
				JsonPatchError,
			);
		}),
		await runCase("remove must fail when array index is out of range", () => {
			assert.throws(() => applyPatch({ items: ["a"] }, [{ op: "remove", path: "/items/2" }]), JsonPatchError);
		}),
		await runCase("array add rejects sparse indexes", () => {
			assert.throws(() => applyPatch({ items: ["a"] }, [{ op: "add", path: "/items/3", value: "b" }]), JsonPatchError);
		}),
		await runCase("add fails when an intermediate parent path is missing", () => {
			assert.throws(() => applyPatch({}, [{ op: "add", path: "/missing/value", value: true }]), JsonPatchError);
		}),
		await runCase("remove fails when an object key is missing", () => {
			assert.throws(() => applyPatch({ user: { name: "Ada" } }, [{ op: "remove", path: "/user/role" }]), JsonPatchError);
		}),
		await runCase("JSON Pointer escaping covers slash and tilde keys", () => {
			assert.deepEqual(
				applyPatch({ "a/b": { "tilde~key": 1 } }, [{ op: "replace", path: "/a~1b/tilde~0key", value: 2 }]),
				{ "a/b": { "tilde~key": 2 } },
			);
		}),
		await runCase("test uses structural equality independent of object key order", () => {
			assert.deepEqual(
				applyPatch({ meta: { a: 1, b: 2 } }, [{ op: "test", path: "/meta", value: { b: 2, a: 1 } }]),
				{ meta: { a: 1, b: 2 } },
			);
		}),
		await runCase("move within the same array follows remove-then-add semantics", () => {
			assert.deepEqual(
				applyPatch({ items: ["a", "b", "c"] }, [{ op: "move", from: "/items/0", path: "/items/2" }]),
				{ items: ["b", "c", "a"] },
			);
		}),
		await runCase("copy creates an independent deep clone", () => {
			const output = applyPatch(
				{ source: { nested: { count: 1 } } },
				[
					{ op: "copy", from: "/source", path: "/copy" },
					{ op: "replace", path: "/source/nested/count", value: 2 },
				],
			);
			assert.deepEqual(output, { source: { nested: { count: 2 } }, copy: { nested: { count: 1 } } });
		}),
		await runCase("root add replaces the entire document without mutating original", () => {
			const input = { old: true };
			assert.deepEqual(applyPatch(input, [{ op: "add", path: "", value: { next: true } }]), { next: true });
			assert.deepEqual(input, { old: true });
		}),
	];
}

async function runConfigHiddenTests(sourceRoot) {
	const modulePath = path.join(sourceRoot, "fixtures/config-migration/src/config.ts");
	const { getActiveEndpoint, loadConfig, saveConfig, setEndpoint } = await importModule(modulePath);

	return [
		await runCase("v1 without timeout migrates with a sensible numeric default", async () => {
			const file = await tempJson({ endpoint: "https://api.example.com" });
			const config = await loadConfig(file);
			assert.equal(config.version, 2);
			assert.equal(config.activeProfile, "default");
			assert.equal(config.profiles.default.endpoint, "https://api.example.com");
			assert.equal(typeof config.profiles.default.timeoutMs, "number");
			assert.ok(config.profiles.default.timeoutMs > 0);
		}),
		await runCase("loadConfig migration does not write back to disk", async () => {
			const original = { endpoint: "https://old.example.com", timeoutMs: 7000 };
			const file = await tempJson(original);
			await loadConfig(file);
			assert.deepEqual(JSON.parse(await readFile(file, "utf8")), original);
		}),
		await runCase("setEndpoint does not mutate the original v2 object", () => {
			const config = {
				version: 2,
				activeProfile: "dev",
				profiles: {
					dev: { endpoint: "http://old-dev", timeoutMs: 1000 },
					prod: { endpoint: "https://prod", timeoutMs: 8000 },
				},
			};
			const next = setEndpoint(config, "http://new-dev");
			assert.equal(next.profiles.dev.endpoint, "http://new-dev");
			assert.equal(config.profiles.dev.endpoint, "http://old-dev");
			assert.notEqual(next, config);
			assert.notEqual(next.profiles, config.profiles);
		}),
		await runCase("setEndpoint preserves inactive profiles exactly", () => {
			const config = {
				version: 2,
				activeProfile: "dev",
				profiles: {
					dev: { endpoint: "http://old-dev", timeoutMs: 1000 },
					prod: { endpoint: "https://prod", timeoutMs: 8000, token: "prod-token" },
				},
			};
			const next = setEndpoint(config, "http://new-dev");
			assert.deepEqual(next.profiles.prod, { endpoint: "https://prod", timeoutMs: 8000, token: "prod-token" });
		}),
		await runCase("saveConfig writes pretty JSON with trailing newline", async () => {
			const file = await tempJson({});
			await saveConfig(file, {
				version: 2,
				activeProfile: "default",
				profiles: { default: { endpoint: "http://new", timeoutMs: 5000 } },
			});
			const text = await readFile(file, "utf8");
			assert.match(text, /\n$/);
			assert.equal(JSON.parse(text).profiles.default.endpoint, "http://new");
		}),
		await runCase("getActiveEndpoint returns selected v2 profile endpoint", () => {
			assert.equal(
				getActiveEndpoint({
					version: 2,
					activeProfile: "prod",
					profiles: {
						default: { endpoint: "http://localhost", timeoutMs: 1000 },
						prod: { endpoint: "https://prod.example.com", timeoutMs: 8000 },
					},
				}),
				"https://prod.example.com",
			);
		}),
	];
}

async function runFlakyHiddenTests(sourceRoot) {
	const asyncBatch = await importModule(path.join(sourceRoot, "fixtures/flaky-triage/src/asyncBatch.ts"));
	const dateBucket = await importModule(path.join(sourceRoot, "fixtures/flaky-triage/src/dateBucket.ts"));
	const sessionStore = await importModule(path.join(sourceRoot, "fixtures/flaky-triage/src/sessionStore.ts"));

	return [
		await runCase("async batch keeps input order over repeated mixed delays", async () => {
			for (let i = 0; i < 5; i++) {
				const values = await asyncBatch.collectInCompletionOrder([
					() => asyncBatch.delay(5, "a"),
					() => asyncBatch.delay(1, "b"),
					() => Promise.resolve("c"),
				]);
				assert.deepEqual(values, ["a", "b", "c"]);
			}
		}),
		await runCase("async batch starts tasks concurrently", async () => {
			const started = [];
			await asyncBatch.collectInCompletionOrder([
				() => {
					started.push("slow");
					return asyncBatch.delay(20, "slow");
				},
				() => {
					started.push("fast");
					return asyncBatch.delay(1, "fast");
				},
			]);
			assert.deepEqual(started, ["slow", "fast"]);
		}),
		await runCase("UTC bucketing handles timestamps with explicit offsets", () => {
			assert.deepEqual(
				dateBucket.bucketByUtcDay(["2026-04-02T23:30:00-02:00", "2026-04-03T00:15:00Z"]),
				{ "2026-04-03": 2 },
			);
		}),
		await runCase("sessions do not share default roles across calls", () => {
			const first = sessionStore.addRole(sessionStore.createSession({ id: "first" }), "admin");
			const second = sessionStore.createSession({ id: "second" });
			assert.deepEqual(first.roles, ["admin"]);
			assert.deepEqual(second.roles, []);
		}),
		await runCase("createSession clones override roles arrays", () => {
			const roles = ["member"];
			const session = sessionStore.createSession({ id: "with-role", roles });
			roles.push("external-mutation");
			assert.deepEqual(session.roles, ["member"]);
		}),
	];
}

async function tempJson(value) {
	const dir = await mkdtemp(path.join(tmpdir(), "model-colosseum-eval-json-"));
	const file = path.join(dir, "config.json");
	await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	return file;
}

function compareRows(a, b) {
	const task = a.taskId.localeCompare(b.taskId);
	if (task) return task;
	return modelRank(a.model) - modelRank(b.model);
}

function modelRank(model) {
	return ["gpt-5.5", "minimax/minimax-m2.7", "xiaomi/mimo-v2-pro", "z-ai/glm-5.1", "moonshotai/kimi-k2.6"].indexOf(model);
}

function renderConsole(rows) {
	return rows
		.map((row) => `${row.taskId}\t${row.model}\toriginal=${row.original.passed}/${row.original.expected}\thidden=${row.hidden.passed}/${row.hidden.total}\tcost=$${formatNumber(row.estimatedCost)}\tduration=${formatSeconds(row.durationMs)}`)
		.join("\n");
}

function renderMarkdown(rows) {
	const lines = [
		"# Hidden Output Quality Tests",
		"",
		"These tests are independent checks against each run commit. They supplement the fixture tests and are not part of the model prompts.",
		"",
		"| Task | Model | Original Tests | Hidden Tests | Estimated Cost | Duration | Commit |",
		"|---|---|---:|---:|---:|---:|---:|",
	];
	for (const row of rows) {
		lines.push(
			`| \`${row.taskId}\` | \`${row.model}\` | ${row.original.passed}/${row.original.expected} | ${row.hidden.passed}/${row.hidden.total} | $${formatNumber(row.estimatedCost)} | ${formatSeconds(row.durationMs)} | \`${row.commit}\` |`,
		);
	}
	lines.push("", "## Failures", "");
	for (const row of rows) {
		const failures = row.hidden.cases.filter((testCase) => !testCase.ok);
		if (!failures.length) continue;
		lines.push(`### ${row.taskId} / ${row.model}`, "");
		for (const failure of failures) {
			lines.push(`- ${failure.name}: ${failure.message.replace(/\s+/g, " ").trim()}`);
		}
		lines.push("");
	}
	return `${lines.join("\n")}\n`;
}

function formatNumber(value) {
	if (typeof value !== "number") return "";
	return value.toFixed(6);
}

function formatSeconds(ms) {
	if (typeof ms !== "number") return "";
	return `${(ms / 1000).toFixed(1)}s`;
}

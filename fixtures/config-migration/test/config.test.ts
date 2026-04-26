import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { DEFAULT_TIMEOUT_MS, getActiveEndpoint, loadConfig, saveConfig, setEndpoint } from "../src/config.ts";

const execFileAsync = promisify(execFile);

async function tempConfig(contents: unknown): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "config-migration-"));
	const file = join(dir, "config.json");
	await writeFile(file, `${JSON.stringify(contents, null, 2)}\n`, "utf8");
	return file;
}

test("loads v1 config and migrates it to v2 shape", async () => {
	const file = await tempConfig({ endpoint: "https://api.example.com", token: "secret", timeoutMs: 5000 });
	const config = await loadConfig(file);

	assert.deepEqual(config, {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: {
				endpoint: "https://api.example.com",
				token: "secret",
				timeoutMs: 5000,
			},
		},
	});
});

test("loads v1 config without version or timeout and applies defaults", async () => {
	const file = await tempConfig({ endpoint: "https://api.example.com" });
	const config = await loadConfig(file);

	assert.deepEqual(config, {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: {
				endpoint: "https://api.example.com",
				timeoutMs: DEFAULT_TIMEOUT_MS,
			},
		},
	});
});

test("saveConfig writes v2 JSON when given a v1 config", async () => {
	const file = await tempConfig({ endpoint: "http://old", timeoutMs: 1000 });

	await saveConfig(file, { endpoint: "http://new" });

	const written = JSON.parse(await readFile(file, "utf8"));
	assert.deepEqual(written, {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: {
				endpoint: "http://new",
				timeoutMs: DEFAULT_TIMEOUT_MS,
			},
		},
	});
});

test("setEndpoint migrates v1 configs before updating", () => {
	assert.deepEqual(setEndpoint({ endpoint: "http://old", timeoutMs: 1000 }, "http://new"), {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: {
				endpoint: "http://new",
				timeoutMs: 1000,
			},
		},
	});
});

test("loads v2 config and resolves active profile endpoint", async () => {
	const file = await tempConfig({
		version: 2,
		activeProfile: "prod",
		profiles: {
			default: { endpoint: "http://localhost:3000", timeoutMs: 1000 },
			prod: { endpoint: "https://prod.example.com", timeoutMs: 8000 },
		},
	});

	assert.equal(getActiveEndpoint(await loadConfig(file)), "https://prod.example.com");
});

test("setEndpoint preserves v2 profiles and updates only active profile", async () => {
	const next = setEndpoint(
		{
			version: 2,
			activeProfile: "dev",
			profiles: {
				dev: { endpoint: "http://old-dev", timeoutMs: 1000 },
				prod: { endpoint: "https://prod", timeoutMs: 8000 },
			},
		},
		"http://new-dev",
	);

	assert.deepEqual(next, {
		version: 2,
		activeProfile: "dev",
		profiles: {
			dev: { endpoint: "http://new-dev", timeoutMs: 1000 },
			prod: { endpoint: "https://prod", timeoutMs: 8000 },
		},
	});
});

test("CLI stays backward compatible with v1 files and writes v2 files", async () => {
	const file = await tempConfig({ endpoint: "http://old", timeoutMs: 1000 });

	const getResult = await execFileAsync(process.execPath, ["src/cli.ts", "get-endpoint", file], {
		cwd: new URL("..", import.meta.url),
	});
	assert.equal(getResult.stdout.trim(), "http://old");

	await execFileAsync(process.execPath, ["src/cli.ts", "set-endpoint", file, "http://new"], {
		cwd: new URL("..", import.meta.url),
	});

	const written = JSON.parse(await readFile(file, "utf8"));
	assert.equal(written.version, 2);
	assert.equal(written.activeProfile, "default");
	assert.equal(written.profiles.default.endpoint, "http://new");
});

test("invalid config shape fails with an actionable error and does not overwrite the file", async () => {
	const file = await tempConfig({
		version: 2,
		activeProfile: "missing",
		profiles: { default: { endpoint: "http://default" } },
	});
	const before = await readFile(file, "utf8");

	await assert.rejects(() => loadConfig(file), /Invalid config.*activeProfile.*damaged config file.*not overwritten/);
	assert.equal(await readFile(file, "utf8"), before);
});

test("CLI does not overwrite damaged JSON", async () => {
	const dir = await mkdtemp(join(tmpdir(), "config-migration-"));
	const file = join(dir, "config.json");
	await writeFile(file, '{"endpoint":', "utf8");

	await assert.rejects(
		() =>
			execFileAsync(process.execPath, ["src/cli.ts", "set-endpoint", file, "http://new"], {
				cwd: new URL("..", import.meta.url),
			}),
		(error: unknown) => {
			assert.match(String((error as { stderr?: string }).stderr), /Invalid config JSON.*damaged config file.*not overwritten/);
			return true;
		},
	);
	assert.equal(await readFile(file, "utf8"), '{"endpoint":');
});

test("damaged config fails with an actionable error and does not overwrite the file", async () => {
	const dir = await mkdtemp(join(tmpdir(), "config-migration-"));
	const file = join(dir, "config.json");
	await writeFile(file, '{"endpoint":', "utf8");

	await assert.rejects(() => loadConfig(file), /Invalid config JSON|Unexpected end/);
	assert.equal(await readFile(file, "utf8"), '{"endpoint":');
});

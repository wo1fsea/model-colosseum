import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { getActiveEndpoint, loadConfig, setEndpoint } from "../src/config.ts";

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

test("damaged config fails with an actionable error and does not overwrite the file", async () => {
	const dir = await mkdtemp(join(tmpdir(), "config-migration-"));
	const file = join(dir, "config.json");
	await writeFile(file, '{"endpoint":', "utf8");

	await assert.rejects(() => loadConfig(file), /Invalid config JSON|Unexpected end/);
	assert.equal(await readFile(file, "utf8"), '{"endpoint":');
});

test("v1 config without version field migrates correctly", async () => {
	const file = await tempConfig({ endpoint: "https://api.example.com" });
	const config = await loadConfig(file);

	assert.deepEqual(config, {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: {
				endpoint: "https://api.example.com",
				timeoutMs: 30000,
			},
		},
	});
});

test("v1 config missing timeoutMs gets sensible default", async () => {
	const file = await tempConfig({ endpoint: "https://api.example.com", token: "secret" });
	const config = await loadConfig(file);

	assert.equal(config.profiles.default.timeoutMs, 30000);
});

test("setEndpoint on v1 config returns v2 shape", async () => {
	const v1Config = { endpoint: "http://old", token: "secret" };
	const result = setEndpoint(v1Config, "http://new");

	assert.equal(result.version, 2);
	assert.equal(result.activeProfile, "default");
	assert.equal(result.profiles.default.endpoint, "http://new");
	assert.equal(result.profiles.default.token, "secret");
});

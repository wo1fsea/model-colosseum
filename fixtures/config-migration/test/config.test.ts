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

test("v1 config without timeoutMs gets default", async () => {
	const file = await tempConfig({ endpoint: "http://localhost:4000" });
	const config = await loadConfig(file);

	assert.equal(config.version, 2);
	assert.equal(config.profiles.default.timeoutMs, 30000);
	assert.equal(config.profiles.default.endpoint, "http://localhost:4000");
});

test("v1 config with explicit version 1 migrates to v2", async () => {
	const file = await tempConfig({ version: 1, endpoint: "https://v1.example.com", timeoutMs: 2000 });
	const config = await loadConfig(file);

	assert.equal(config.version, 2);
	assert.equal(config.activeProfile, "default");
	assert.equal(config.profiles.default.endpoint, "https://v1.example.com");
	assert.equal(config.profiles.default.timeoutMs, 2000);
});

test("loadConfig does not mutate the on-disk file for v1 configs", async () => {
	const file = await tempConfig({ endpoint: "https://readonly.example.com", token: "abc" });
	const originalContent = await readFile(file, "utf8");

	await loadConfig(file);

	const afterContent = await readFile(file, "utf8");
	assert.equal(afterContent, originalContent);
});

test("setEndpoint does not mutate the original config object", () => {
	const original: import("../src/config.ts").AppConfigV2 = {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: { endpoint: "http://original", timeoutMs: 1000 },
		},
	};

	const updated = setEndpoint(original, "http://updated");

	// Original should be unchanged
	assert.equal(original.profiles.default.endpoint, "http://original");
	assert.equal(updated.profiles.default.endpoint, "http://updated");
});

test("CLI set-endpoint does not collapse v2 config back to v1", async () => {
	const file = await tempConfig({
		version: 2,
		activeProfile: "prod",
		profiles: {
			default: { endpoint: "http://localhost:3000", timeoutMs: 1000 },
			prod: { endpoint: "https://prod.example.com", timeoutMs: 8000 },
		},
	});

	await execFileAsync(process.execPath, ["src/cli.ts", "set-endpoint", file, "https://new-prod.example.com"], {
		cwd: new URL("..", import.meta.url),
	});

	const written = JSON.parse(await readFile(file, "utf8"));
	assert.equal(written.version, 2);
	assert.equal(written.activeProfile, "prod");
	assert.equal(written.profiles.prod.endpoint, "https://new-prod.example.com");
	assert.equal(written.profiles.default.endpoint, "http://localhost:3000");
});

test("config with neither endpoint nor profiles produces actionable error", async () => {
	const file = await tempConfig({ foo: "bar" });
	await assert.rejects(() => loadConfig(file), /Invalid config/);
});

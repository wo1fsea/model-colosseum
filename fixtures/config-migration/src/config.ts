import { readFile, writeFile } from "node:fs/promises";

export const DEFAULT_TIMEOUT_MS = 30_000;

export interface AppConfigV1 {
	version?: 1;
	endpoint: string;
	token?: string;
	timeoutMs?: number;
}

export interface AppConfigV2 {
	version: 2;
	activeProfile: string;
	profiles: Record<
		string,
		{
			endpoint: string;
			token?: string;
			timeoutMs: number;
		}
	>;
}

export type AppConfig = AppConfigV1 | AppConfigV2;

type ProfileConfig = AppConfigV2["profiles"][string];

export async function loadConfig(path: string): Promise<AppConfigV2> {
	const raw = await readFile(path, "utf8");
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid config JSON at ${path}: ${detail}. Fix the damaged config file before retrying; it was not overwritten.`);
	}

	return normalizeConfig(parsed, path);
}

export async function saveConfig(path: string, config: AppConfig): Promise<void> {
	const normalized = normalizeConfig(config, path);
	await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function getActiveEndpoint(config: AppConfig): string {
	const normalized = normalizeConfig(config, "config");
	return normalized.profiles[normalized.activeProfile].endpoint;
}

export function setEndpoint(config: AppConfig, endpoint: string): AppConfigV2 {
	if (typeof endpoint !== "string") {
		throw new Error("Invalid endpoint: endpoint must be a string.");
	}

	const normalized = normalizeConfig(config, "config");
	return {
		...normalized,
		profiles: {
			...normalized.profiles,
			[normalized.activeProfile]: {
				...normalized.profiles[normalized.activeProfile],
				endpoint,
			},
		},
	};
}

function normalizeConfig(value: unknown, source: string): AppConfigV2 {
	if (!isRecord(value)) {
		throw invalidConfig(source, "config must be a JSON object");
	}

	if (value.version === 2 || "profiles" in value || "activeProfile" in value) {
		return normalizeV2Config(value, source);
	}

	return migrateV1Config(value, source);
}

function migrateV1Config(value: Record<string, unknown>, source: string): AppConfigV2 {
	if ("version" in value && value.version !== undefined && value.version !== 1) {
		throw invalidConfig(source, "unsupported config version; expected version 1 or 2");
	}

	return {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: normalizeProfile(value, source, "default profile"),
		},
	};
}

function normalizeV2Config(value: Record<string, unknown>, source: string): AppConfigV2 {
	if (value.version !== 2) {
		throw invalidConfig(source, "v2 config must include version: 2");
	}
	if (typeof value.activeProfile !== "string" || value.activeProfile.length === 0) {
		throw invalidConfig(source, "activeProfile must be a non-empty string");
	}
	if (!isRecord(value.profiles)) {
		throw invalidConfig(source, "profiles must be an object keyed by profile name");
	}

	const profiles: AppConfigV2["profiles"] = {};
	for (const [name, profile] of Object.entries(value.profiles)) {
		if (name.length === 0) {
			throw invalidConfig(source, "profile names must be non-empty strings");
		}
		profiles[name] = normalizeProfile(profile, source, `profiles.${name}`);
	}

	if (Object.keys(profiles).length === 0) {
		throw invalidConfig(source, "profiles must include at least one profile");
	}
	if (!(value.activeProfile in profiles)) {
		throw invalidConfig(source, `activeProfile '${value.activeProfile}' does not exist in profiles`);
	}

	return {
		version: 2,
		activeProfile: value.activeProfile,
		profiles,
	};
}

function normalizeProfile(value: unknown, source: string, label: string): ProfileConfig {
	if (!isRecord(value)) {
		throw invalidConfig(source, `${label} must be an object`);
	}
	if (typeof value.endpoint !== "string") {
		throw invalidConfig(source, `${label}.endpoint must be a string`);
	}
	if ("token" in value && value.token !== undefined && typeof value.token !== "string") {
		throw invalidConfig(source, `${label}.token must be a string when provided`);
	}

	return {
		endpoint: value.endpoint,
		...(value.token === undefined ? {} : { token: value.token }),
		timeoutMs: normalizeTimeout(value.timeoutMs, source, `${label}.timeoutMs`),
	};
}

function normalizeTimeout(value: unknown, source: string, label: string): number {
	if (value === undefined) return DEFAULT_TIMEOUT_MS;
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw invalidConfig(source, `${label} must be a non-negative number when provided`);
	}
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidConfig(source: string, detail: string): Error {
	return new Error(`Invalid config at ${source}: ${detail}. Fix the damaged config file before retrying; it was not overwritten.`);
}

import { readFile, writeFile } from "node:fs/promises";

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

const DEFAULT_TIMEOUT_MS = 30000;

function migrateV1toV2(v1: AppConfigV1): AppConfigV2 {
	return {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: {
				endpoint: v1.endpoint,
				token: v1.token,
				timeoutMs: v1.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			},
		},
	};
}

function isV2Config(parsed: unknown): parsed is AppConfigV2 {
	return typeof parsed === "object" && parsed !== null && "profiles" in parsed;
}

export async function loadConfig(path: string): Promise<AppConfigV2> {
	let raw: string;
	try {
		raw = await readFile(path, "utf8");
	} catch (err: any) {
		throw new Error(`Cannot read config file "${path}": ${err.message}`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err: any) {
		throw new Error(`Invalid config JSON in "${path}": ${err.message}`);
	}

	if (isV2Config(parsed)) {
		return parsed;
	}

	// Treat as v1 config (may omit version field)
	if (typeof parsed === "object" && parsed !== null && "endpoint" in parsed) {
		return migrateV1toV2(parsed as AppConfigV1);
	}

	throw new Error(`Invalid config in "${path}": missing "endpoint" or "profiles" field`);
}

export async function saveConfig(path: string, config: AppConfigV2): Promise<void> {
	await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function getActiveEndpoint(config: AppConfigV2): string {
	return config.profiles[config.activeProfile].endpoint;
}

export function setEndpoint(config: AppConfigV2, endpoint: string): AppConfigV2 {
	return {
		...config,
		profiles: {
			...config.profiles,
			[config.activeProfile]: {
				...config.profiles[config.activeProfile],
				endpoint,
			},
		},
	};
}

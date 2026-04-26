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

export type AppConfig = AppConfigV2;

const DEFAULT_TIMEOUT_MS = 30000;

function isV1Config(obj: unknown): obj is AppConfigV1 {
	if (typeof obj !== "object" || obj === null) return false;
	const rec = obj as Record<string, unknown>;
	// v1 has endpoint but no profiles key (or version is explicitly 1)
	return typeof rec.endpoint === "string" && !rec.profiles;
}

function migrateV1ToV2(v1: AppConfigV1): AppConfigV2 {
	return {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: {
				endpoint: v1.endpoint,
				...(v1.token !== undefined ? { token: v1.token } : {}),
				timeoutMs: v1.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			},
		},
	};
}

function isV2Config(obj: unknown): obj is AppConfigV2 {
	if (typeof obj !== "object" || obj === null) return false;
	const rec = obj as Record<string, unknown>;
	return rec.version === 2 && typeof rec.activeProfile === "string" && typeof rec.profiles === "object" && rec.profiles !== null;
}

export async function loadConfig(path: string): Promise<AppConfig> {
	let raw: string;
	try {
		raw = await readFile(path, "utf8");
	} catch (err) {
		throw new Error(`Failed to read config file at "${path}": ${err instanceof Error ? err.message : String(err)}`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new Error(`Invalid config JSON at "${path}": ${err instanceof Error ? err.message : String(err)}. File may be damaged; please repair or restore from backup.`);
	}

	if (isV2Config(parsed)) {
		return parsed;
	}

	if (isV1Config(parsed)) {
		return migrateV1ToV2(parsed);
	}

	throw new Error(`Unrecognized config format at "${path}": expected a v1 config (with "endpoint") or v2 config (with "version": 2 and "profiles").`);
}

export async function saveConfig(path: string, config: AppConfigV2): Promise<void> {
	await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function getActiveEndpoint(config: AppConfig): string {
	return config.profiles[config.activeProfile].endpoint;
}

export function setEndpoint(config: AppConfig | AppConfigV1, endpoint: string): AppConfig {
	// Migrate v1 to v2 if needed
	const v2Config = isV1Config(config) ? migrateV1ToV2(config) : config;
	
	// Return a new object with only the active profile updated (immutability)
	return {
		...v2Config,
		profiles: {
			...v2Config.profiles,
			[v2Config.activeProfile]: {
				...v2Config.profiles[v2Config.activeProfile],
				endpoint,
			},
		},
	};
}

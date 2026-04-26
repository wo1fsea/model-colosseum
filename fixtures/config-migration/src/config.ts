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

export function migrateToV2(config: AppConfigV1): AppConfigV2 {
	const timeoutMs = config.timeoutMs ?? 5000;
	return {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: {
				endpoint: config.endpoint,
				token: config.token,
				timeoutMs,
			},
		},
	};
}

export async function loadConfig(path: string): Promise<AppConfig> {
	let raw: string;
	try {
		raw = await readFile(path, "utf8");
	} catch (error) {
		throw new Error(`Failed to read config file: ${error instanceof Error ? error.message : String(error)}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		throw new Error(`Invalid config JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (typeof parsed !== "object" || parsed === null) {
		throw new Error("Config must be an object");
	}
	const config = parsed as AppConfig;
	if ("profiles" in config) return config;
	return migrateToV2(config as AppConfigV1);
}

export async function saveConfig(path: string, config: AppConfig): Promise<void> {
	const v2Config: AppConfigV2 =
		"profiles" in config ? config : migrateToV2(config as AppConfigV1);
	await writeFile(path, `${JSON.stringify(v2Config, null, 2)}\n`, "utf8");
}

export function getActiveEndpoint(config: AppConfig): string {
	if ("profiles" in config) {
		return config.profiles[config.activeProfile].endpoint;
	}
	return config.endpoint;
}

export function setEndpoint(config: AppConfig, endpoint: string): AppConfig {
	if ("profiles" in config) {
		config.profiles[config.activeProfile].endpoint = endpoint;
		return config;
	}
	const v2 = migrateToV2(config as AppConfigV1);
	v2.profiles.default.endpoint = endpoint;
	return v2;
}

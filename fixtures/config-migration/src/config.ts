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

export async function loadConfig(path: string): Promise<AppConfig> {
	const raw = await readFile(path, "utf8");
	const parsed = JSON.parse(raw) as AppConfig;
	if ("profiles" in parsed) return parsed;
	return parsed;
}

export async function saveConfig(path: string, config: AppConfig): Promise<void> {
	await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
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
	return { ...config, endpoint };
}

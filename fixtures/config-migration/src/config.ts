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

export async function loadConfig(path: string): Promise<AppConfigV2> {
	const raw = await readFile(path, "utf8");
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new Error(
			`Invalid config JSON in ${path}: ${err instanceof Error ? err.message : String(err)}`
		);
	}

	if (parsed && typeof parsed === "object" && "profiles" in parsed) {
		return parsed as AppConfigV2;
	}

	const v1 = parsed as AppConfigV1;
	return {
		version: 2,
		activeProfile: "default",
		profiles: {
			default: {
				endpoint: v1.endpoint,
				token: v1.token,
				timeoutMs: v1.timeoutMs ?? 5000,
			},
		},
	};
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

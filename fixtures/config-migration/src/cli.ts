#!/usr/bin/env node
import { loadConfig, saveConfig, getActiveEndpoint, setEndpoint } from "./config.ts";

const [, , command, configPath, value] = process.argv;

if (!command || !configPath) {
	console.error("Usage: node src/cli.ts <get-endpoint|set-endpoint> <config-path> [value]");
	process.exit(2);
}

try {
	const config = await loadConfig(configPath);
	if (command === "get-endpoint") {
		console.log(getActiveEndpoint(config));
	} else if (command === "set-endpoint") {
		if (!value) throw new Error("set-endpoint requires a value");
		await saveConfig(configPath, setEndpoint(config, value));
	} else {
		throw new Error(`Unknown command: ${command}`);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}

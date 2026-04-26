export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonPatchOperation =
	| { op: "add"; path: string; value: JsonValue }
	| { op: "remove"; path: string }
	| { op: "replace"; path: string; value: JsonValue }
	| { op: "move"; from: string; path: string }
	| { op: "copy"; from: string; path: string }
	| { op: "test"; path: string; value: JsonValue };

export class JsonPatchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "JsonPatchError";
	}
}

export function applyPatch<T extends JsonValue>(document: T, operations: JsonPatchOperation[]): T {
	let next = clone(document);
	for (const operation of operations) {
		next = applyOperation(next, operation) as T;
	}
	return next;
}

function applyOperation(document: JsonValue, operation: JsonPatchOperation): JsonValue {
	switch (operation.op) {
		case "add":
			return setAtPath(document, operation.path, operation.value);
		case "replace":
			return setAtPath(document, operation.path, operation.value);
		default:
			throw new JsonPatchError(`Unsupported operation: ${operation.op}`);
	}
}

function setAtPath(document: JsonValue, path: string, value: JsonValue): JsonValue {
	if (path === "") return clone(value);
	const parts = parsePointer(path);
	const root = clone(document);
	let target: JsonValue = root;

	for (let i = 0; i < parts.length - 1; i++) {
		if (target === null || typeof target !== "object") {
			throw new JsonPatchError(`Cannot traverse through non-container at ${parts.slice(0, i + 1).join("/")}`);
		}
		target = (target as Record<string, JsonValue>)[parts[i]];
	}

	const key = parts.at(-1);
	if (key === undefined || target === null || typeof target !== "object" || Array.isArray(target)) {
		throw new JsonPatchError(`Invalid object path: ${path}`);
	}

	(target as Record<string, JsonValue>)[key] = clone(value);
	return root;
}

function parsePointer(path: string): string[] {
	if (!path.startsWith("/")) throw new JsonPatchError(`Invalid JSON pointer: ${path}`);
	return path
		.slice(1)
		.split("/")
		.map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function clone<T extends JsonValue>(value: T): T {
	return structuredClone(value);
}

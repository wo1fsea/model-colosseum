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
			return setAtPath(document, operation.path, operation.value, "add");
		case "remove":
			return removeAtPath(document, operation.path);
		case "replace":
			return setAtPath(document, operation.path, operation.value, "replace");
		case "move": {
			const value = getAtPath(document, operation.from);
			let result = removeAtPath(document, operation.from);
			return setAtPath(result, operation.path, value, "add");
		}
		case "copy": {
			const value = getAtPath(document, operation.from);
			return setAtPath(document, operation.path, value, "add");
		}
		case "test":
			testAtPath(document, operation.path, operation.value);
			return document;
		default:
			throw new JsonPatchError(`Unsupported operation: ${operation.op}`);
	}
}

function getAtPath(document: JsonValue, path: string): JsonValue {
	if (path === "") return clone(document);
	const parts = parsePointer(path);
	let current: JsonValue = document;

	for (const part of parts) {
		if (current === null || typeof current !== "object") {
			throw new JsonPatchError(`Cannot access non-container at path`);
		}
		if (Array.isArray(current)) {
			const index = part === "-" ? current.length : parseInt(part, 10);
			if (isNaN(index) || index < 0 || index > current.length) {
				throw new JsonPatchError(`Invalid array index: ${part}`);
			}
			current = current[index];
		} else {
			if (typeof current !== "object") {
				throw new JsonPatchError(`Cannot access non-container at path`);
			}
			current = (current as Record<string, JsonValue>)[part];
			if (current === undefined) {
				throw new JsonPatchError(`Path not found: ${path}`);
			}
		}
	}

	return clone(current);
}

function testAtPath(document: JsonValue, path: string, value: JsonValue): void {
	const actual = getAtPath(document, path);
	if (!deepEqual(actual, value)) {
		throw new JsonPatchError(`Test failed: value at ${path} does not match`);
	}
}

function removeAtPath(document: JsonValue, path: string): JsonValue {
	if (path === "") {
		throw new JsonPatchError("Cannot remove root");
	}
	const parts = parsePointer(path);
	const root = clone(document);
	let target: JsonValue = root;

	for (let i = 0; i < parts.length - 1; i++) {
		if (target === null || typeof target !== "object") {
			throw new JsonPatchError(`Cannot traverse through non-container`);
		}
		if (Array.isArray(target)) {
			const index = parts[i] === "-" ? target.length - 1 : parseInt(parts[i], 10);
			if (isNaN(index) || index < 0 || index >= target.length) {
				throw new JsonPatchError(`Invalid array index: ${parts[i]}`);
			}
			target = target[index];
		} else {
			target = (target as Record<string, JsonValue>)[parts[i]];
			if (target === undefined) {
				throw new JsonPatchError(`Path not found`);
			}
		}
	}

	const key = parts.at(-1)!;
	if (Array.isArray(target)) {
		const index = key === "-" ? target.length - 1 : parseInt(key, 10);
		if (isNaN(index) || index < 0 || index >= target.length) {
			throw new JsonPatchError(`Invalid array index: ${key}`);
		}
		target.splice(index, 1);
	} else {
		if (typeof target !== "object" || target === null) {
			throw new JsonPatchError(`Cannot remove at non-container path`);
		}
		delete (target as Record<string, JsonValue>)[key];
	}

	return root;
}

function setAtPath(document: JsonValue, path: string, value: JsonValue, operationType: "add" | "replace"): JsonValue {
	if (path === "") return clone(value);
	const parts = parsePointer(path);
	const root = clone(document);
	let target: JsonValue = root;

	for (let i = 0; i < parts.length - 1; i++) {
		if (target === null || typeof target !== "object") {
			throw new JsonPatchError(`Cannot traverse through non-container`);
		}
		if (Array.isArray(target)) {
			const index = parts[i] === "-" ? target.length : parseInt(parts[i], 10);
			if (isNaN(index) || index < 0 || index > target.length) {
				throw new JsonPatchError(`Invalid array index: ${parts[i]}`);
			}
			target = target[index];
		} else {
			target = (target as Record<string, JsonValue>)[parts[i]];
			if (target === undefined) {
				// Create missing intermediate path
				target = {};
				(target as Record<string, JsonValue>)[parts[i]] = target;
			}
		}
	}

	const key = parts.at(-1)!;
	if (Array.isArray(target)) {
		const index = key === "-" ? target.length : parseInt(key, 10);
		if (isNaN(index) || index < 0 || index > target.length) {
			throw new JsonPatchError(`Invalid array index: ${key}`);
		}
		if (operationType === "add") {
			target.splice(index, 0, clone(value));
		} else {
			if (index >= target.length) {
				throw new JsonPatchError(`Path not found for replace: ${path}`);
			}
			target[index] = clone(value);
		}
	} else {
		if (typeof target !== "object" || target === null) {
			throw new JsonPatchError(`Cannot set at non-container path`);
		}
		if (operationType === "replace") {
			if (!(key in (target as Record<string, JsonValue>))) {
				throw new JsonPatchError(`Path not found for replace: ${path}`);
			}
		}
		(target as Record<string, JsonValue>)[key] = clone(value);
	}

	return root;
}

function deepEqual(a: JsonValue, b: JsonValue): boolean {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (a === null || b === null) return a === b;
	if (typeof a !== "object") return a === b;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}
	const aObj = a as Record<string, JsonValue>;
	const bObj = b as Record<string, JsonValue>;
	const keysA = Object.keys(aObj);
	const keysB = Object.keys(bObj);
	if (keysA.length !== keysB.length) return false;
	for (const key of keysA) {
		if (!keysB.includes(key)) return false;
		if (!deepEqual(aObj[key], bObj[key])) return false;
	}
	return true;
}

function parsePointer(path: string): string[] {
	if (!path.startsWith("/") && path !== "") throw new JsonPatchError(`Invalid JSON pointer: ${path}`);
	if (path === "") return [];
	return path
		.slice(1)
		.split("/")
		.map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function clone<T extends JsonValue>(value: T): T {
	return structuredClone(value);
}

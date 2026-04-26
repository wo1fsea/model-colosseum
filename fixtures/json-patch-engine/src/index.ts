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
	let next: JsonValue = clone(document);
	for (const operation of operations) {
		next = applyOperation(next, operation);
	}
	return next as T;
}

function applyOperation(document: JsonValue, operation: JsonPatchOperation): JsonValue {
	switch (operation.op) {
		case "add":
			return addAtPath(document, operation.path, operation.value);
		case "remove":
			return removeAtPath(document, operation.path);
		case "replace":
			return replaceAtPath(document, operation.path, operation.value);
		case "move":
			return moveAtPath(document, operation.from, operation.path);
		case "copy":
			return copyAtPath(document, operation.from, operation.path);
		case "test":
			return testAtPath(document, operation.path, operation.value);
		default:
			throw new JsonPatchError(`Unsupported operation: ${(operation as JsonPatchOperation).op}`);
	}
}

function addAtPath(document: JsonValue, path: string, value: JsonValue): JsonValue {
	if (path === "") return clone(value);
	const { target, key } = traverseToParent(document, path);
	if (Array.isArray(target)) {
		if (key === "-") {
			target.push(clone(value));
		} else {
			const index = Number(key);
			if (String(index) !== key || index < 0 || index > target.length) {
				throw new JsonPatchError(`Array index out of bounds: ${key}`);
			}
			target.splice(index, 0, clone(value));
		}
	} else {
		target[key] = clone(value);
	}
	return document;
}

function replaceAtPath(document: JsonValue, path: string, value: JsonValue): JsonValue {
	if (path === "") return clone(value);
	const { target, key } = traverseToParent(document, path);
	if (Array.isArray(target)) {
		const index = Number(key);
		if (String(index) !== key || index < 0 || index >= target.length) {
			throw new JsonPatchError(`Array index out of bounds: ${key}`);
		}
		target[index] = clone(value);
	} else {
		if (!Object.hasOwn(target, key)) {
			throw new JsonPatchError(`Path not found: ${path}`);
		}
		target[key] = clone(value);
	}
	return document;
}

function removeAtPath(document: JsonValue, path: string): JsonValue {
	if (path === "") {
		throw new JsonPatchError("Cannot remove root document");
	}
	const { target, key } = traverseToParent(document, path);
	if (Array.isArray(target)) {
		const index = Number(key);
		if (String(index) !== key || index < 0 || index >= target.length) {
			throw new JsonPatchError(`Array index out of bounds: ${key}`);
		}
		target.splice(index, 1);
	} else {
		if (!Object.hasOwn(target, key)) {
			throw new JsonPatchError(`Path not found: ${path}`);
		}
		delete target[key];
	}
	return document;
}

function getValue(document: JsonValue, path: string): JsonValue | undefined {
	if (path === "") return document;
	const parts = parsePointer(path);
	let current: JsonValue = document;
	for (const part of parts) {
		if (current === null || typeof current !== "object") return undefined;
		if (Array.isArray(current)) {
			if (part === "-") return undefined;
			const index = Number(part);
			if (String(index) !== part || index < 0 || index >= current.length) return undefined;
			current = current[index];
		} else {
			if (!Object.hasOwn(current, part)) return undefined;
			current = (current as Record<string, JsonValue>)[part];
		}
	}
	return current;
}

function testAtPath(document: JsonValue, path: string, value: JsonValue): JsonValue {
	const actual = getValue(document, path);
	if (!deepEqual(actual, value)) {
		throw new JsonPatchError("Test failed");
	}
	return document;
}

function moveAtPath(document: JsonValue, from: string, path: string): JsonValue {
	const value = getValue(document, from);
	if (value === undefined) {
		throw new JsonPatchError(`Path not found: ${from}`);
	}
	let next = removeAtPath(document, from);
	next = addAtPath(next, path, value);
	return next;
}

function copyAtPath(document: JsonValue, from: string, path: string): JsonValue {
	const value = getValue(document, from);
	if (value === undefined) {
		throw new JsonPatchError(`Path not found: ${from}`);
	}
	return addAtPath(document, path, value);
}

function traverseToParent(document: JsonValue, path: string): { target: Record<string, JsonValue> | JsonValue[]; key: string } {
	const parts = parsePointer(path);
	let current: JsonValue = document;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (current === null || typeof current !== "object") {
			throw new JsonPatchError("Path not found");
		}
		if (Array.isArray(current)) {
			if (part === "-") {
				throw new JsonPatchError("Cannot traverse through array append marker");
			}
			const index = Number(part);
			if (String(index) !== part || index < 0 || index >= current.length) {
				throw new JsonPatchError(`Array index out of bounds: ${part}`);
			}
			current = current[index];
		} else {
			if (!Object.hasOwn(current, part)) {
				throw new JsonPatchError("Path not found");
			}
			current = (current as Record<string, JsonValue>)[part];
		}
	}
	const key = parts[parts.length - 1];
	if (current === null || typeof current !== "object") {
		throw new JsonPatchError("Path not found");
	}
	return { target: current as Record<string, JsonValue> | JsonValue[], key };
}

function deepEqual(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (a === null || b === null) return a === b;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}
	if (typeof a === "object" && typeof b === "object") {
		const keysA = Object.keys(a);
		const keysB = Object.keys(b);
		if (keysA.length !== keysB.length) return false;
		for (const key of keysA) {
			if (!keysB.includes(key)) return false;
			if (!deepEqual((a as Record<string, JsonValue>)[key], (b as Record<string, JsonValue>)[key])) return false;
		}
		return true;
	}
	return false;
}

function parsePointer(path: string): string[] {
	if (path === "") return [];
	if (!path.startsWith("/")) throw new JsonPatchError(`Invalid JSON pointer: ${path}`);
	return path
		.slice(1)
		.split("/")
		.map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function clone<T extends JsonValue>(value: T): T {
	return structuredClone(value);
}

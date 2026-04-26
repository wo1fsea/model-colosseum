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
	// Clone upfront so we never mutate the original.
	// If any operation fails, the original is untouched.
	let next = clone(document);
	for (const operation of operations) {
		next = applyOperation(next, operation) as T;
	}
	return next;
}

function applyOperation(document: JsonValue, operation: JsonPatchOperation): JsonValue {
	switch (operation.op) {
		case "add":
			return addOp(document, operation.path, operation.value);
		case "remove":
			return removeOp(document, operation.path);
		case "replace":
			return replaceOp(document, operation.path, operation.value);
		case "move":
			return moveOp(document, operation.from, operation.path);
		case "copy":
			return copyOp(document, operation.from, operation.path);
		case "test":
			return testOp(document, operation.path, operation.value);
		default:
			throw new JsonPatchError(`Unsupported operation: ${(operation as { op: string }).op}`);
	}
}

// ---------- operations ----------

function addOp(document: JsonValue, path: string, value: JsonValue): JsonValue {
	return setAtPath(document, path, value, { insert: true });
}

function removeOp(document: JsonValue, path: string): JsonValue {
	if (path === "") {
		throw new JsonPatchError("Cannot remove the root document");
	}
	return removeAtPath(document, path);
}

function replaceOp(document: JsonValue, path: string, value: JsonValue): JsonValue {
	// replace must fail if the target path does not exist
	getAtPath(document, path);
	return setAtPath(document, path, value, { insert: false });
}

function moveOp(document: JsonValue, from: string, path: string): JsonValue {
	// move: remove from source, then add to destination
	const value = getAtPath(document, from);
	const afterRemove = removeAtPath(document, from);
	return setAtPath(afterRemove, path, value, { insert: true });
}

function copyOp(document: JsonValue, from: string, path: string): JsonValue {
	// copy: deep-copy the value from source, then add to destination
	const value = clone(getAtPath(document, from));
	return setAtPath(document, path, value, { insert: true });
}

function testOp(document: JsonValue, path: string, expected: JsonValue): JsonValue {
	const actual = getAtPath(document, path);
	if (!deepEqual(actual, expected)) {
		throw new JsonPatchError(`Test failed: value at ${path} does not match expected`);
	}
	return document;
}

// ---------- path helpers ----------

function parsePointer(path: string): string[] {
	if (!path.startsWith("/")) throw new JsonPatchError(`Invalid JSON pointer: ${path}`);
	return path
		.slice(1)
		.split("/")
		.map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function getAtPath(document: JsonValue, path: string): JsonValue {
	if (path === "") return document;
	const parts = parsePointer(path);
	let current: JsonValue = document;
	for (const part of parts) {
		if (current === null || typeof current !== "object") {
			throw new JsonPatchError(`Cannot traverse through non-container at /${part}`);
		}
		if (Array.isArray(current)) {
			const idx = Number(part);
			if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
				throw new JsonPatchError(`Array index out of bounds: ${part}`);
			}
			current = current[idx];
		} else {
			if (!(part in current as Record<string, JsonValue>)) {
				throw new JsonPatchError(`Key not found: ${part}`);
			}
			current = (current as Record<string, JsonValue>)[part];
		}
	}
	return current;
}

function setAtPath(document: JsonValue, path: string, value: JsonValue, options: { insert: boolean }): JsonValue {
	if (path === "") return clone(value);
	const parts = parsePointer(path);
	const root = clone(document);
	let current: JsonValue = root;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (current === null || typeof current !== "object") {
			throw new JsonPatchError(`Cannot traverse through non-container at /${part}`);
		}
		if (Array.isArray(current)) {
			const idx = Number(part);
			if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
				throw new JsonPatchError(`Array index out of bounds: ${part}`);
			}
			current = current[idx];
		} else {
			current = (current as Record<string, JsonValue>)[part];
		}
	}

	const key = parts.at(-1)!;
	if (current === null || typeof current !== "object") {
		throw new JsonPatchError(`Cannot set value on non-container at parent path`);
	}

	if (Array.isArray(current)) {
		if (key === "-") {
			// append
			current.push(clone(value));
		} else {
			const idx = Number(key);
			if (!Number.isInteger(idx) || idx < 0 || idx > current.length) {
				throw new JsonPatchError(`Array index out of bounds: ${key}`);
			}
			if (options.insert) {
				// insert at index (shifts existing elements)
				current.splice(idx, 0, clone(value));
			} else {
				// replace at index
				current[idx] = clone(value);
			}
		}
	} else {
		(current as Record<string, JsonValue>)[key] = clone(value);
	}

	return root;
}

function removeAtPath(document: JsonValue, path: string): JsonValue {
	if (path === "") {
		throw new JsonPatchError("Cannot remove the root document");
	}
	const parts = parsePointer(path);
	const root = clone(document);
	let current: JsonValue = root;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (current === null || typeof current !== "object") {
			throw new JsonPatchError(`Cannot traverse through non-container at /${part}`);
		}
		if (Array.isArray(current)) {
			const idx = Number(part);
			if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
				throw new JsonPatchError(`Array index out of bounds: ${part}`);
			}
			current = current[idx];
		} else {
			if (!(part in current as Record<string, JsonValue>)) {
				throw new JsonPatchError(`Key not found: ${part}`);
			}
			current = (current as Record<string, JsonValue>)[part];
		}
	}

	const key = parts.at(-1)!;
	if (current === null || typeof current !== "object") {
		throw new JsonPatchError(`Cannot remove from non-container`);
	}

	if (Array.isArray(current)) {
		const idx = Number(key);
		if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
			throw new JsonPatchError(`Array index out of bounds: ${key}`);
		}
		current.splice(idx, 1);
	} else {
		if (!(key in current as Record<string, JsonValue>)) {
			throw new JsonPatchError(`Key not found: ${key}`);
		}
		delete (current as Record<string, JsonValue>)[key];
	}

	return root;
}

// ---------- utilities ----------

function clone<T extends JsonValue>(value: T): T {
	return structuredClone(value);
}

function deepEqual(a: JsonValue, b: JsonValue): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((v, i) => deepEqual(v, b[i]));
	}

	if (typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
		const aObj = a as Record<string, JsonValue>;
		const bObj = b as Record<string, JsonValue>;
		const aKeys = Object.keys(aObj);
		const bKeys = Object.keys(bObj);
		if (aKeys.length !== bKeys.length) return false;
		return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
	}

	return false;
}

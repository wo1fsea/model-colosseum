import assert from "node:assert/strict";
import test from "node:test";
import { applyPatch, JsonPatchError } from "../src/index.ts";

test("adds and replaces nested object values without mutating the original", () => {
	const input = { user: { name: "Ada", flags: { active: false } } };
	const output = applyPatch(input, [
		{ op: "add", path: "/user/role", value: "admin" },
		{ op: "replace", path: "/user/flags/active", value: true },
	]);

	assert.deepEqual(output, { user: { name: "Ada", role: "admin", flags: { active: true } } });
	assert.deepEqual(input, { user: { name: "Ada", flags: { active: false } } });
});

test("supports array insert, append, remove, and replace", () => {
	const output = applyPatch({ items: ["a", "c"] }, [
		{ op: "add", path: "/items/1", value: "b" },
		{ op: "add", path: "/items/-", value: "d" },
		{ op: "remove", path: "/items/0" },
		{ op: "replace", path: "/items/1", value: "C" },
	]);

	assert.deepEqual(output, { items: ["b", "C", "d"] });
});

test("supports copy and move with deep-copy behavior", () => {
	const input = { source: { nested: { value: 1 } }, target: {}, list: ["x"] };
	const output = applyPatch(input, [
		{ op: "copy", from: "/source", path: "/target/copied" },
		{ op: "replace", path: "/source/nested/value", value: 2 },
		{ op: "move", from: "/list/0", path: "/target/moved" },
	]);

	assert.deepEqual(output, {
		source: { nested: { value: 2 } },
		target: { copied: { nested: { value: 1 } }, moved: "x" },
		list: [],
	});
});

test("supports test operation and fails loudly when values differ", () => {
	assert.deepEqual(
		applyPatch({ status: "ready" }, [
			{ op: "test", path: "/status", value: "ready" },
			{ op: "replace", path: "/status", value: "done" },
		]),
		{ status: "done" },
	);

	assert.throws(() => applyPatch({ status: "ready" }, [{ op: "test", path: "/status", value: "done" }]), JsonPatchError);
});

test("is atomic when any operation fails", () => {
	const input = { a: { b: 1 }, list: ["x"] };

	assert.throws(
		() =>
			applyPatch(input, [
				{ op: "replace", path: "/a/b", value: 2 },
				{ op: "remove", path: "/missing/value" },
			]),
		JsonPatchError,
	);

	assert.deepEqual(input, { a: { b: 1 }, list: ["x"] });
});

test("supports JSON Pointer escaping", () => {
	const output = applyPatch({ "a/b": { "c~d": 1 } }, [
		{ op: "test", path: "/a~1b/c~0d", value: 1 },
		{ op: "replace", path: "/a~1b/c~0d", value: 2 },
		{ op: "add", path: "/a~1b/e~1f", value: true },
	]);

	assert.deepEqual(output, { "a/b": { "c~d": 2, "e/f": true } });
});

test("requires replace, remove, and copy targets to exist", () => {
	assert.throws(() => applyPatch({ a: 1 }, [{ op: "replace", path: "/missing", value: 2 }]), JsonPatchError);
	assert.throws(() => applyPatch({ a: 1 }, [{ op: "remove", path: "/missing" }]), JsonPatchError);
	assert.throws(() => applyPatch({ a: 1 }, [{ op: "copy", from: "/missing", path: "/b" }]), JsonPatchError);
});

test("handles root paths and move uses remove-before-add semantics", () => {
	assert.deepEqual(applyPatch({ a: 1 }, [{ op: "replace", path: "", value: { b: 2 } }]), { b: 2 });
	assert.deepEqual(applyPatch(["a", "b", "c"], [{ op: "move", from: "/0", path: "/2" }]), ["b", "c", "a"]);
	assert.throws(() => applyPatch({ a: { b: 1 } }, [{ op: "move", from: "/a", path: "/a/b/c" }]), JsonPatchError);
});

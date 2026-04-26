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

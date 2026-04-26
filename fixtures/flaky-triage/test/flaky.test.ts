import assert from "node:assert/strict";
import test from "node:test";
import { collectInCompletionOrder, delay } from "../src/asyncBatch.ts";
import { bucketByUtcDay } from "../src/dateBucket.ts";
import { addRole, createSession } from "../src/sessionStore.ts";

test("async batch preserves input order even when tasks complete out of order", async () => {
	const values = await collectInCompletionOrder([
		() => delay(20, "first"),
		() => delay(1, "second"),
		() => delay(5, "third"),
	]);

	assert.deepEqual(values, ["first", "second", "third"]);
});

test("UTC day bucketing is stable across local timezones", () => {
	const buckets = bucketByUtcDay([
		"2026-04-02T01:15:00Z",
		"2026-04-02T23:30:00Z",
	]);

	assert.deepEqual(buckets, {
		"2026-04-02": 2,
	});
});

test("sessions do not share mutable role arrays", () => {
	const admin = addRole(createSession({ id: "admin" }), "admin");
	const guest = createSession({ id: "guest" });

	assert.deepEqual(admin, { id: "admin", roles: ["admin"] });
	assert.deepEqual(guest, { id: "guest", roles: [] });
});

test("session factory remains isolated over repeated calls", () => {
	for (let i = 0; i < 20; i++) {
		const session = createSession({ id: `user-${i}` });
		assert.deepEqual(session.roles, []);
	}
});

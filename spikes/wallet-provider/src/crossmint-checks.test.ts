import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECKS } from "./checklist.ts";
import { CROSSMINT_DEVNET_CHECKS, crossmintAttempt } from "./crossmint-checks.ts";

const check = (id: string) => {
	const found = CHECKS.find((c) => c.id === id);
	assert.ok(found, id);
	return found;
};

describe("CROSSMINT_DEVNET_CHECKS", () => {
	it("runs the same checks as Turnkey's devnet run", () => {
		assert.deepEqual([...CROSSMINT_DEVNET_CHECKS].sort(), [
			"over-size-limit",
			"swap-approved-tokens",
			"swap-unapproved-token",
			"transfer-outside",
			"transfer-owner",
			"unapproved-program",
			"under-size-limit",
		]);
	});
});

describe("crossmintAttempt", () => {
	it("reports a transaction Crossmint sent as allowed, with its signature", async () => {
		const attempt = crossmintAttempt({ "transfer-owner": async () => "sig1" }, () => undefined);
		assert.deepEqual(await attempt(check("transfer-owner")), {
			status: "allowed",
			signature: "sig1",
		});
	});

	it("reports what the classifier recognises as a refusal", async () => {
		const attempt = crossmintAttempt(
			{
				"transfer-outside": async () => {
					throw new Error("scope says no");
				},
			},
			(error) =>
				error instanceof Error && error.message === "scope says no"
					? "recipient not allowed"
					: undefined,
		);
		assert.deepEqual(await attempt(check("transfer-outside")), {
			status: "refused",
			reason: "recipient not allowed",
		});
	});

	it("reports anything the classifier doesn't recognise as an error", async () => {
		const attempt = crossmintAttempt(
			{
				"transfer-outside": async () => {
					throw new Error("network down");
				},
			},
			() => undefined,
		);
		assert.deepEqual(await attempt(check("transfer-outside")), {
			status: "error",
			message: "network down",
		});
	});

	it("reports a check with no transaction as an error", async () => {
		const outcome = await crossmintAttempt({}, () => undefined)(check("pay-approved-recipient"));
		assert.equal(outcome.status, "error");
	});
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECKS } from "./checklist.ts";
import type { SignOutcome } from "./providers/turnkey-signer.ts";
import { attemptFor, type Tools, TURNKEY_DEVNET_CHECKS } from "./refusal-checks.ts";

function tools(sign: SignOutcome, submit: () => Promise<string> = async () => "sig123") {
	const built: string[] = [];
	const submitted: string[] = [];
	const t: Tools = {
		build: async (id) => {
			built.push(id);
			return `unsigned-${id}`;
		},
		sign: async () => sign,
		submit: async (signedHex) => {
			submitted.push(signedHex);
			return submit();
		},
	};
	return { t, built, submitted };
}

const check = (id: string) => {
	const found = CHECKS.find((c) => c.id === id);
	assert.ok(found, id);
	return found;
};

describe("TURNKEY_DEVNET_CHECKS", () => {
	it("covers the refusal table for #19 and nothing that needs mainnet or recipient lists", () => {
		assert.deepEqual([...TURNKEY_DEVNET_CHECKS].sort(), [
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

describe("attemptFor", () => {
	it("sends an allowed transaction and reports its signature once it lands", async () => {
		const { t, submitted } = tools({ status: "signed", signedHex: "signed" });
		assert.deepEqual(await attemptFor(t)(check("transfer-owner")), {
			status: "allowed",
			signature: "sig123",
		});
		assert.deepEqual(submitted, ["signed"]);
	});

	it("reports an allowed transaction that fails on-chain as an error", async () => {
		const { t } = tools({ status: "signed", signedHex: "signed" }, async () => {
			throw new Error("insufficient funds");
		});
		const outcome = await attemptFor(t)(check("transfer-owner"));
		assert.equal(outcome.status, "error");
		assert.ok(outcome.status === "error" && outcome.message.includes("insufficient funds"));
	});

	it("never sends a transaction that should have been refused, even if it was signed", async () => {
		const { t, submitted } = tools({ status: "signed", signedHex: "should-not-exist" });
		const outcome = await attemptFor(t)(check("transfer-outside"));
		assert.equal(outcome.status, "allowed");
		assert.deepEqual(submitted, []);
	});

	it("passes Turnkey's refusals and errors through unchanged", async () => {
		const refused = tools({
			status: "refused",
			reason: "ACTIVITY_STATUS_CONSENSUS_NEEDED: no policy",
		});
		assert.deepEqual(await attemptFor(refused.t)(check("over-size-limit")), {
			status: "refused",
			reason: "ACTIVITY_STATUS_CONSENSUS_NEEDED: no policy",
		});
		assert.deepEqual(refused.submitted, []);

		const failed = tools({ status: "error", message: "fetch failed" });
		assert.deepEqual(await attemptFor(failed.t)(check("transfer-owner")), {
			status: "error",
			message: "fetch failed",
		});
	});

	it("refuses to attempt a check it has no transaction for", async () => {
		const { t, built } = tools({ status: "signed", signedHex: "x" });
		const outcome = await attemptFor(t)(check("pay-approved-recipient"));
		assert.equal(outcome.status, "error");
		assert.deepEqual(built, []);
	});

	it("attempts other checks when the caller lists them, still never sending a refused one", async () => {
		const { t, built, submitted } = tools({ status: "signed", signedHex: "signed" });
		const attempt = attemptFor(t, ["pay-approved-recipient", "pay-removed-recipient"]);
		assert.equal((await attempt(check("pay-approved-recipient"))).status, "allowed");
		assert.equal((await attempt(check("pay-removed-recipient"))).status, "allowed");
		assert.equal((await attempt(check("transfer-owner"))).status, "error");
		assert.deepEqual(built, ["pay-approved-recipient", "pay-removed-recipient"]);
		assert.deepEqual(submitted, ["signed"]);
	});
});

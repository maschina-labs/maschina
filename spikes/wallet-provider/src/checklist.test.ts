import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHECKS } from "./checklist.ts";

describe("the checklist", () => {
	it("gives every check a unique id", () => {
		const ids = CHECKS.map((check) => check.id);
		assert.equal(new Set(ids).size, ids.length);
	});

	it("pairs every refusal with an allowed check, so a broken setup can't pass as a refusal", () => {
		for (const check of CHECKS.filter((c) => c.expect === "refused")) {
			const pair = CHECKS.find((c) => c.id === check.pairedWith);
			assert.ok(pair, `${check.id} is paired with a missing check`);
			assert.equal(pair.expect, "allowed", `${check.id} must be paired with an allowed check`);
			assert.equal(
				pair.network,
				check.network,
				`${check.id} and its pair must run on the same network`,
			);
		}
	});

	it("covers every rule of the machine wallet policy", () => {
		const refused = new Set(CHECKS.filter((c) => c.expect === "refused").map((c) => c.id));
		for (const id of [
			"transfer-outside",
			"swap-unapproved-token",
			"over-size-limit",
			"unapproved-program",
			"pay-unapproved-recipient",
			"pay-removed-recipient",
		]) {
			assert.ok(refused.has(id), `missing refusal ${id}`);
		}
		const allowed = new Set(CHECKS.filter((c) => c.expect === "allowed").map((c) => c.id));
		for (const id of [
			"transfer-owner",
			"swap-approved-tokens",
			"under-size-limit",
			"pay-approved-recipient",
			"mainnet-swap",
		]) {
			assert.ok(allowed.has(id), `missing allowed check ${id}`);
		}
	});

	it("keeps real money to the one mainnet swap", () => {
		const mainnet = CHECKS.filter((c) => c.network === "mainnet").map((c) => c.id);
		assert.deepEqual(mainnet, ["mainnet-swap"]);
	});
});

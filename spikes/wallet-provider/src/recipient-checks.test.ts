import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Check } from "./checklist.ts";
import { RECIPIENT_CHECKS, runRecipientChecks } from "./recipient-checks.ts";
import type { Outcome } from "./run.ts";

const RECIPIENT = "recipient-address";
const STRANGER = "stranger-address";

/** A provider that records every call, allowing payments only to listed recipients. */
function fakeProvider(options: { failApprove?: boolean; payThrows?: string } = {}) {
	const calls: string[] = [];
	const listed = new Set<string>();
	return {
		calls,
		listed,
		steps: {
			setRecipients: async (recipients: string[]) => {
				calls.push(`set [${recipients.join(",")}]`);
				if (options.failApprove && recipients.length > 0) throw new Error("policy update failed");
				listed.clear();
				for (const r of recipients) listed.add(r);
			},
			pay: async (check: Check, to: string): Promise<Outcome> => {
				calls.push(`pay ${check.id} ${to}`);
				if (options.payThrows === check.id) throw new Error("rpc down");
				return listed.has(to)
					? { status: "allowed", signature: `sig-${check.id}` }
					: { status: "refused", reason: "not on the list" };
			},
		},
	};
}

describe("RECIPIENT_CHECKS", () => {
	it("covers the three recipient rows of the checklist", () => {
		assert.deepEqual(
			RECIPIENT_CHECKS.map((c) => c.id),
			["pay-approved-recipient", "pay-unapproved-recipient", "pay-removed-recipient"],
		);
	});
});

describe("runRecipientChecks", () => {
	it("approves, pays, pays a stranger, removes, then pays the removed recipient", async () => {
		const provider = fakeProvider();
		const results = await runRecipientChecks({
			recipient: RECIPIENT,
			stranger: STRANGER,
			steps: provider.steps,
		});
		assert.deepEqual(provider.calls, [
			"set [recipient-address]",
			"pay pay-approved-recipient recipient-address",
			"pay pay-unapproved-recipient stranger-address",
			"set []",
			"pay pay-removed-recipient recipient-address",
		]);
		assert.deepEqual(
			results.map((r) => [r.id, r.outcome.status]),
			[
				["pay-approved-recipient", "allowed"],
				["pay-unapproved-recipient", "refused"],
				["pay-removed-recipient", "refused"],
			],
		);
	});

	it("removes the recipient even when a payment throws, and reports the error", async () => {
		const provider = fakeProvider({ payThrows: "pay-unapproved-recipient" });
		const results = await runRecipientChecks({
			recipient: RECIPIENT,
			stranger: STRANGER,
			steps: provider.steps,
		});
		assert.equal(provider.listed.size, 0);
		assert.deepEqual(results[1]?.outcome, { status: "error", message: "rpc down" });
	});

	it("never pays anyone when the recipient couldn't be approved", async () => {
		const provider = fakeProvider({ failApprove: true });
		const results = await runRecipientChecks({
			recipient: RECIPIENT,
			stranger: STRANGER,
			steps: provider.steps,
		});
		assert.ok(!provider.calls.some((call) => call.startsWith("pay")));
		assert.ok(results.every((r) => r.outcome.status === "error"));
		assert.equal(provider.calls.at(-1), "set []");
	});

	it("doesn't pay the removed recipient when removing it failed", async () => {
		const provider = fakeProvider();
		let sets = 0;
		const results = await runRecipientChecks({
			recipient: RECIPIENT,
			stranger: STRANGER,
			steps: {
				...provider.steps,
				setRecipients: async (recipients) => {
					sets += 1;
					if (sets === 2) throw new Error("remove failed");
					await provider.steps.setRecipients(recipients);
				},
			},
		});
		assert.ok(!provider.calls.includes("pay pay-removed-recipient recipient-address"));
		assert.equal(results[2]?.outcome.status, "error");
	});
});

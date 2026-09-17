import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type SignClient, turnkeySigner } from "./turnkey-signer.ts";

const WALLET = "6Xa6BehnAkS9tUui8hYgNs9qjFmuxZe2pGZm9k8u2uvh";

const failWith = (fields: { message: string; activityStatus?: string }): SignClient => ({
	signTransaction: async () => {
		throw Object.assign(new Error(fields.message), fields);
	},
});

describe("turnkeySigner", () => {
	it("asks Turnkey to sign a Solana transaction for the wallet", async () => {
		let seen: Parameters<SignClient["signTransaction"]>[0] | undefined;
		const signer = turnkeySigner(WALLET, {
			signTransaction: async (body) => {
				seen = body;
				return { signedTransaction: "beef" };
			},
		});
		assert.deepEqual(await signer.sign("cafe"), { status: "signed", signedHex: "beef" });
		assert.deepEqual(seen, {
			signWith: WALLET,
			unsignedTransaction: "cafe",
			type: "TRANSACTION_TYPE_SOLANA",
		});
	});

	it("reports Turnkey's policy engine denial as a refusal, with each policy's outcome", async () => {
		// The shape Turnkey returned on devnet, 2026-09-16.
		const denied: SignClient = {
			signTransaction: async () => {
				throw Object.assign(new Error("Turnkey error 7: You don't have sufficient permissions"), {
					name: "TurnkeyRequestError",
					code: 7,
					details: [
						{
							"@type": "type.googleapis.com/errors.v1.PolicyEnginePermissionError",
							message: "No policies evaluated to outcome: Allow",
							policyEvaluations: [
								{ policyId: "d682a674", outcome: "OUTCOME_DENY_IMPLICIT" },
								{ policyId: "4469cfbb", outcome: "OUTCOME_DENY_IMPLICIT" },
							],
						},
					],
				});
			},
		};
		const outcome = await turnkeySigner(WALLET, denied).sign("cafe");
		assert.deepEqual(outcome, {
			status: "refused",
			reason:
				"No policies evaluated to outcome: Allow (OUTCOME_DENY_IMPLICIT, OUTCOME_DENY_IMPLICIT)",
		});
	});

	it("reports an activity waiting on approval, or rejected, as a refusal", async () => {
		for (const fields of [
			{
				message: "activity requires consensus",
				activityStatus: "ACTIVITY_STATUS_CONSENSUS_NEEDED",
			},
			{ message: "rejected", activityStatus: "ACTIVITY_STATUS_REJECTED" },
		]) {
			const outcome = await turnkeySigner(WALLET, failWith(fields)).sign("cafe");
			assert.equal(outcome.status, "refused", fields.message);
			assert.ok(outcome.status === "refused" && outcome.reason.includes(fields.activityStatus));
		}
	});

	it("reports anything else as an error, never as a refusal", async () => {
		for (const fields of [
			{ message: "fetch failed" },
			{ message: "internal error", activityStatus: "ACTIVITY_STATUS_FAILED" },
			{ message: "invalid transaction bytes" },
			// Mentioning policies in words isn't enough. Only Turnkey's structured denial counts.
			{
				message: "Policy evaluation denied the activity",
				activityStatus: "ACTIVITY_STATUS_FAILED",
			},
		]) {
			const outcome = await turnkeySigner(WALLET, failWith(fields)).sign("cafe");
			assert.equal(outcome.status, "error", fields.message);
		}
	});

	it("treats an empty signature as an error", async () => {
		const outcome = await turnkeySigner(WALLET, {
			signTransaction: async () => ({ signedTransaction: "" }),
		}).sign("cafe");
		assert.equal(outcome.status, "error");
	});
});

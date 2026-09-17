import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyCrossmintError } from "./crossmint-errors.ts";

// Shapes Crossmint returned on devnet, 2026-09-16.
const simulationFailure = (err: unknown, logs: string[]) =>
	new Error(
		JSON.stringify({
			error: true,
			message: "Transaction simulation failed. Please check the transaction payload.",
			code: "TRANSACTION_SIMULATION_FAILED",
			simulation: { success: false, err, logs },
		}),
	);

const enforcement = (line: number, code: string, number: number, message: string) =>
	`Program log: AnchorError thrown in programs/solana-smart-account/src/instructions/shared/enforcement.rs:${line}. Error Code: ${code}. Error Number: ${number}. Error Message: ${message}.`;

describe("classifyCrossmintError", () => {
	it("recognises the smart account refusing a recipient", () => {
		const error = simulationFailure({ InstructionError: [2, { Custom: 6017 }] }, [
			"Program XmSwiXQsxSZYKVYbSAkkvQVvdrKo1nwwfvZBPQrLzbU invoke [1]",
			enforcement(
				402,
				"RecipientNotAllowed",
				6017,
				"Transfer destination not in the policy's allowed recipients list",
			),
			"Program XmSwiXQsxSZYKVYbSAkkvQVvdrKo1nwwfvZBPQrLzbU failed: custom program error: 0x1781",
		]);
		assert.equal(
			classifyCrossmintError(error),
			"RecipientNotAllowed: Transfer destination not in the policy's allowed recipients list",
		);
	});

	it("recognises the smart account refusing a spend over the limit", () => {
		const error = simulationFailure({ InstructionError: [2, { Custom: 6012 }] }, [
			enforcement(
				589,
				"SpendingLimitExceeded",
				6012,
				"Transaction exceeds the signer's spending limit for this token",
			),
		]);
		assert.equal(
			classifyCrossmintError(error),
			"SpendingLimitExceeded: Transaction exceeds the signer's spending limit for this token",
		);
	});

	it("doesn't count a simulation that failed for any other reason", () => {
		const error = simulationFailure({ InstructionError: [3, "InvalidAccountData"] }, [
			"Program log: Error: InvalidAccountData",
			"Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA failed: invalid account data for instruction",
		]);
		assert.equal(classifyCrossmintError(error), undefined);
	});

	it("doesn't count an Anchor error from anywhere but the policy enforcement code", () => {
		const error = simulationFailure({ InstructionError: [2, { Custom: 6000 }] }, [
			"Program log: AnchorError thrown in programs/other/src/lib.rs:10. Error Code: Whatever. Error Number: 6000. Error Message: Not a policy.",
		]);
		assert.equal(classifyCrossmintError(error), undefined);
	});

	it("doesn't count errors that aren't Crossmint's JSON", () => {
		for (const error of [
			new Error("fetch failed"),
			new Error("{not json"),
			"RecipientNotAllowed",
			undefined,
		]) {
			assert.equal(classifyCrossmintError(error), undefined);
		}
	});
});

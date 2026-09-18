import { describe, expect, it } from "vitest";
import { classFor, classifyError, resumeTimeFrom } from "./classify.ts";
import { respondTo } from "./failure.ts";

const NOW = new Date("2026-09-18T12:00:00Z");

describe("classifyError, on errors these services really produce", () => {
	it("calls a wallet provider refusal an authority failure", () => {
		for (const message of [
			"TurnkeyRequestError: PolicyEnginePermissionError: no policies evaluated to outcome Allow",
			"RecipientNotAllowed: Transfer destination not in the policy's allowed recipients list",
			"OperationNotPermitted: asset decrease without a matching spending limit",
			"the activity was rejected by consensus",
		]) {
			expect(classFor(new Error(message)), message).toBe("authority");
		}
	});

	it("calls a limit running out a budget failure", () => {
		for (const message of [
			"SpendingLimitExceeded: Transaction exceeds the signer's spending limit for this token",
			"the budget cannot cover this action",
			"limit exceeded",
		]) {
			expect(classFor(new Error(message)), message).toBe("budget");
		}
	});

	it("calls a rate limit a waiting failure, and reads the wait when it is given", () => {
		expect(classFor(new Error("429 Too Many Requests"))).toBe("waiting");
		const failure = classifyError(new Error("rate limit reached, retry-after: 30"), {}, NOW);
		expect(failure.class).toBe("waiting");
		expect(failure.resumesAt?.toISOString()).toBe("2026-09-18T12:00:30.000Z");
	});

	it("waits without a time when the error doesn't say one, which pauses rather than guesses", () => {
		const failure = classifyError(new Error("daily rent cap exceeded"), {}, NOW);
		expect(failure).toEqual({ class: "waiting" });
		expect(respondTo(failure, 1)).toEqual({ action: "pause", notify: true });
	});

	it("calls a swap that can never work a permanent failure", () => {
		for (const message of [
			"No route found for the requested swap",
			"slippage tolerance exceeded",
			"insufficient funds for the transfer",
			"invalid mint address",
		]) {
			expect(classFor(new Error(message)), message).toBe("permanent");
		}
	});

	it("calls a network problem transient", () => {
		for (const message of [
			"fetch failed",
			"ETIMEDOUT",
			"socket hang up",
			"503 Service Unavailable",
			"Blockhash not found",
			"Node is behind by 153 slots",
			"connection terminated unexpectedly",
		]) {
			expect(classFor(new Error(message)), message).toBe("transient");
		}
	});

	it("calls anything it doesn't recognise unknown, which stops the machine", () => {
		for (const error of [
			new Error("something odd happened"),
			"surprise",
			42,
			null,
			undefined,
			{},
		]) {
			expect(classFor(error), String(error)).toBe("unknown");
		}
		expect(respondTo({ class: "unknown" }, 1)).toEqual({ action: "pause", notify: true });
	});

	it("reads the error's code and cause, not only its message", () => {
		const withCode = Object.assign(new Error("request failed"), { code: "ECONNRESET" });
		expect(classFor(withCode)).toBe("transient");
		const withCause = new Error("could not sign", { cause: "PolicyEnginePermissionError" });
		expect(classFor(withCause)).toBe("authority");
	});

	it("reads an error that is a plain object, as providers often return", () => {
		expect(classFor({ code: "TRANSACTION_SIMULATION_FAILED", message: "no route found" })).toBe(
			"permanent",
		);
	});
});

describe("classifyError, once a transaction has been sent", () => {
	it("calls an unclear failure ambiguous, never transient", () => {
		expect(classFor(new Error("fetch failed"), { sent: true })).toBe("ambiguous");
		expect(classFor(new Error("something odd"), { sent: true })).toBe("ambiguous");
		expect(classFor(new Error("insufficient funds"), { sent: true })).toBe("ambiguous");
	});

	it("still trusts a definite refusal, which cannot have landed", () => {
		expect(classFor(new Error("PolicyEnginePermissionError"), { sent: true })).toBe("authority");
		expect(classFor(new Error("SpendingLimitExceeded"), { sent: true })).toBe("budget");
	});

	it("calls a confirmation that never came ambiguous, sent or not", () => {
		for (const message of [
			"Transaction was not confirmed in 30.00 seconds",
			"transaction expired: block height exceeded",
			"unable to confirm transaction",
		]) {
			expect(classFor(new Error(message)), message).toBe("ambiguous");
			expect(classFor(new Error(message), { sent: true }), message).toBe("ambiguous");
		}
	});

	it("means the answer is to ask the chain, never to retry", () => {
		expect(respondTo(classifyError(new Error("fetch failed"), { sent: true }), 1)).toEqual({
			action: "reconcile",
		});
	});
});

describe("resumeTimeFrom", () => {
	it("reads seconds and milliseconds", () => {
		expect(resumeTimeFrom(new Error("retry-after: 5"), NOW)?.toISOString()).toBe(
			"2026-09-18T12:00:05.000Z",
		);
		expect(resumeTimeFrom(new Error("retry in 500 ms"), NOW)?.toISOString()).toBe(
			"2026-09-18T12:00:00.500Z",
		);
	});

	it("gives nothing when the error doesn't say, rather than inventing a time", () => {
		expect(resumeTimeFrom(new Error("rate limited"), NOW)).toBeUndefined();
	});
});

describe("every failure class has exactly one response", () => {
	it("never retries anything but a transient failure", () => {
		const classes = [
			"transient",
			"permanent",
			"ambiguous",
			"authority",
			"budget",
			"waiting",
			"unknown",
		] as const;
		for (const kind of classes) {
			const response = respondTo({ class: kind }, 1);
			if (kind !== "transient") expect(response.action, kind).not.toBe("retry");
		}
	});

	it("gives up on a transient failure that keeps happening", () => {
		expect(respondTo({ class: "transient" }, 1)).toEqual({ action: "retry" });
		expect(respondTo({ class: "transient" }, 3)).toMatchObject({ action: "pause" });
	});
});

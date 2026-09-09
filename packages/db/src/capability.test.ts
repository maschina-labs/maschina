/**
 * The capability projection.
 *
 * A capability has no row anywhere. If this fold is wrong, the authority model
 * is wrong and nothing else in the system would notice, which is why it is pure
 * and tested without a database.
 */

import { describe, expect, it } from "vitest";
import {
	CAPABILITY_GRANTED,
	CAPABILITY_RESERVED,
	CAPABILITY_REVOKED,
	CAPABILITY_SETTLED,
	foldCapability,
} from "./capability.ts";
import { PAYLOAD_V } from "./log.ts";

type LogEvent = { type: string; payload: Record<string, unknown> };

const grantedEvent = (overrides: Record<string, unknown> = {}): LogEvent => ({
	type: CAPABILITY_GRANTED,
	payload: {
		v: PAYLOAD_V,
		capabilityId: "cap_1",
		parent: null,
		holder: "worker:w1",
		resource: "filesystem",
		operations: ["write"],
		scope: "/tmp/sandbox",
		limits: { granted: 0, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		approval: "none",
		expiresAt: null,
		delegationDepth: 0,
		...overrides,
	},
});

const revokedEvent = (): LogEvent => ({
	type: CAPABILITY_REVOKED,
	payload: { v: PAYLOAD_V, capabilityId: "cap_1", reason: "test" },
});

describe("foldCapability", () => {
	it("returns null when nothing was granted", () => {
		expect(foldCapability([])).toBeNull();
		expect(foldCapability([revokedEvent()])).toBeNull();
	});

	it("builds an active capability from a grant", () => {
		const cap = foldCapability([grantedEvent()]);
		expect(cap?.status).toBe("active");
		expect(cap?.holder).toBe("worker:w1");
		expect(cap?.operations).toEqual(["write"]);
		expect(cap?.scope).toBe("/tmp/sandbox");
	});

	it("revokes, and revocation is terminal", () => {
		expect(foldCapability([grantedEvent(), revokedEvent()])?.status).toBe("revoked");
	});

	it("stays revoked when a later grant event appears for the same id", () => {
		// Found by writing this test. The fold used to reset status to active on
		// any grant event, so appending one for a revoked id resurrected it. The
		// log is append-only and anything holding INSERT can append, so that made
		// revocation a suggestion rather than a control, and P3 says revocation
		// always works. A re-grant is a new capability with a new id.
		const cap = foldCapability([grantedEvent(), revokedEvent(), grantedEvent()]);
		expect(cap?.status).toBe("revoked");
	});

	it("expires when the clock passes expiresAt", () => {
		const past = new Date(Date.now() - 60_000).toISOString();
		const cap = foldCapability([grantedEvent({ expiresAt: past })]);
		expect(cap?.status).toBe("expired");
	});

	it("does not expire before expiresAt", () => {
		const future = new Date(Date.now() + 60_000).toISOString();
		expect(foldCapability([grantedEvent({ expiresAt: future })])?.status).toBe("active");
	});

	it("prefers revoked over expired", () => {
		// Revoked is a stronger statement than expired: someone decided, rather
		// than a clock passing. The log should say the deliberate thing.
		const past = new Date(Date.now() - 60_000).toISOString();
		const cap = foldCapability([grantedEvent({ expiresAt: past }), revokedEvent()]);
		expect(cap?.status).toBe("revoked");
	});

	it("keeps the parent link, so revocation can walk the subtree", () => {
		expect(foldCapability([grantedEvent({ parent: "cap_root" })])?.parent).toBe("cap_root");
	});

	it("reads an unversioned event as version 1", () => {
		const legacy = grantedEvent();
		delete (legacy.payload as Record<string, unknown>).v;
		expect(foldCapability([legacy])?.status).toBe("active");
	});

	it("refuses a payload version from the future rather than guessing", () => {
		expect(() => foldCapability([grantedEvent({ v: PAYLOAD_V + 1 })])).toThrow(
			/newer than this reader understands/,
		);
	});

	it("ignores event types it does not know about", () => {
		const cap = foldCapability([
			grantedEvent(),
			{ type: "capability.invented.later", payload: { v: PAYLOAD_V, capabilityId: "cap_1" } },
		]);
		expect(cap?.status).toBe("active");
	});

	it("is deterministic", () => {
		const events = [grantedEvent(), revokedEvent()];
		expect(foldCapability(events)).toEqual(foldCapability(events));
	});
});

describe("foldCapability, the three numbers", () => {
	const model = (limits = { granted: 1_000_000, reserved: 0, settled: 0 }): LogEvent =>
		grantedEvent({ resource: "model", operations: ["invoke"], scope: "fast", limits });

	const reserved = (amount: number): LogEvent => ({
		type: CAPABILITY_RESERVED,
		payload: { v: PAYLOAD_V, capabilityId: "cap_1", amount },
	});

	const settled = (amount: number, against: number): LogEvent => ({
		type: CAPABILITY_SETTLED,
		payload: { v: PAYLOAD_V, capabilityId: "cap_1", amount, reserved: against },
	});

	const available = (c: ReturnType<typeof foldCapability>): number => {
		// Throws rather than asserting non-null, so a fold that unexpectedly
		// returns null fails as itself instead of as an unrelated arithmetic error.
		if (c === null) throw new Error("expected a capability, got null");
		return c.limits.granted - c.limits.reserved - c.limits.settled;
	};

	it("starts with everything available", () => {
		const c = foldCapability([model()]);
		expect(available(c)).toBe(1_000_000);
	});

	it("holds a reservation against the balance before anything is spent", () => {
		// The whole reason there are three numbers. Between Intent and Outcome the
		// money is neither available nor spent, and a single balance cannot say so.
		const c = foldCapability([model(), reserved(50_000)]);
		expect(c?.limits.reserved).toBe(50_000);
		expect(c?.limits.settled).toBe(0);
		expect(available(c)).toBe(950_000);
	});

	it("keeps a reservation held when the process died before settling", () => {
		// A crash between Intent and Outcome leaves this shape in the log forever.
		// The budget stays held, which is the safe direction: recovery decides,
		// not a default that quietly hands the money back.
		const c = foldCapability([model(), reserved(50_000)]);
		expect(available(c)).toBe(950_000);
		expect(c?.limits.settled).toBe(0);
	});

	it("releases the reservation and records the real cost at settlement", () => {
		const c = foldCapability([model(), reserved(50_000), settled(12_345, 50_000)]);
		expect(c?.limits.reserved).toBe(0);
		expect(c?.limits.settled).toBe(12_345);
		expect(available(c)).toBe(987_655);
	});

	it("gives back the difference when a call cost less than reserved", () => {
		// Reserving an estimate and settling the truth is the point. If settlement
		// released only what was spent, every cheap call would leak the difference
		// out of the budget permanently.
		const c = foldCapability([model(), reserved(100_000), settled(1_000, 100_000)]);
		expect(available(c)).toBe(999_000);
	});

	it("keeps an overspend visible rather than clamping it", () => {
		// A call that cost more than reserved is a fact about what happened. The
		// log records what happened, not what should have.
		const c = foldCapability([model(), reserved(10_000), settled(90_000, 10_000)]);
		expect(c?.limits.settled).toBe(90_000);
		expect(available(c)).toBe(910_000);
	});

	it("can drive the balance to nothing, which is what authorize refuses on", () => {
		const c = foldCapability([
			model({ granted: 60_000, reserved: 0, settled: 0 }),
			reserved(60_000),
		]);
		expect(available(c)).toBe(0);
	});

	it("sums many calls in order", () => {
		const c = foldCapability([
			model(),
			reserved(50_000),
			settled(20_000, 50_000),
			reserved(50_000),
			settled(30_000, 50_000),
		]);
		expect(c?.limits.settled).toBe(50_000);
		expect(c?.limits.reserved).toBe(0);
		expect(available(c)).toBe(950_000);
	});

	it("refuses an unreadable amount rather than treating it as free", () => {
		// P8: ambiguity blocks. Defaulting a missing amount to zero would hand back
		// budget nobody released, and it would do it silently.
		expect(() =>
			foldCapability([
				model(),
				{ type: CAPABILITY_RESERVED, payload: { v: PAYLOAD_V, capabilityId: "cap_1" } },
			]),
		).toThrow(/whole number of micro-dollars/);
	});

	it("refuses a fractional amount", () => {
		// Money is integers here. Floating point error accumulates across a long
		// objective and the log is permanent.
		expect(() => foldCapability([model(), reserved(0.5)])).toThrow(/whole number/);
	});

	it("refuses a negative amount, which would be a refund nobody granted", () => {
		expect(() => foldCapability([model(), reserved(-100)])).toThrow(/whole number/);
	});
});

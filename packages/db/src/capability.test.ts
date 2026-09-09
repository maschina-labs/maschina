/**
 * The capability projection.
 *
 * A capability has no row anywhere. If this fold is wrong, the authority model
 * is wrong and nothing else in the system would notice, which is why it is pure
 * and tested without a database.
 */

import { describe, expect, it } from "vitest";
import { CAPABILITY_GRANTED, CAPABILITY_REVOKED, foldCapability } from "./capability.ts";
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

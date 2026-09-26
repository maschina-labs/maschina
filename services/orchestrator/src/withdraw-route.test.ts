import { newId } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.ts";
import type { MachineStates, Withdrawer } from "./withdraw-route.ts";

const token = "d".repeat(40);
const logger = createLogger({ service: "test", level: "silent" });
const machineId = newId<"machine">();
const withdrawalId = newId<"withdrawal">();

const sent = {
	status: "sent" as const,
	withdrawalId,
	signature: "5".repeat(88),
	to: "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu",
	lamports: "250000000",
};

function app(states: MachineStates, withdrawer: Withdrawer) {
	return buildApp({
		version: "1.0.0",
		daemonToken: token,
		logger,
		checks: [],
		runs: { claim: async () => ({ ok: true, value: undefined }) },
		reports: { report: async () => ({ ok: true, value: undefined }) },
		contexts: { contextFor: async () => undefined },
		leases: { holds: async () => undefined },
		paperSigner: {
			simulate: async () => {
				throw new Error("not used here");
			},
		},
		signer: {
			sign: async () => {
				throw new Error("not used here");
			},
		},
		renewals: { renew: async () => ({ ok: true, value: new Date() }) },
		states,
		withdrawer,
	});
}

const ask = (target: ReturnType<typeof app>, body: unknown) =>
	target.request("/internal/v1/withdraw", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});

const request = { withdrawalId, machineId, lamports: "250000000" };
const stopped: MachineStates = { stateOf: async () => "stopped" };
const neverAsk: Withdrawer = {
	withdraw: async () => {
		throw new Error("the signer must not be asked");
	},
};

describe("asking for a machine's funds back", () => {
	it("passes it to the signer and gives the answer back unchanged", async () => {
		const withdraw = vi.fn(async () => sent);

		const res = await ask(app(stopped, { withdraw }), request);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(sent);
		expect(withdraw).toHaveBeenCalledWith(request);
	});

	it("works for a paused machine as well as a stopped one", async () => {
		const withdraw = vi.fn(async () => sent);

		const res = await ask(app({ stateOf: async () => "paused" }, { withdraw }), request);

		expect(res.status).toBe(200);
		expect(withdraw).toHaveBeenCalledOnce();
	});

	it("refuses while the machine is still running, and says to stop it first", async () => {
		// A machine mid-trade has money committed. Taking the wallet out from under it would leave a
		// signed trade with nothing to pay for it.
		const res = await ask(app({ stateOf: async () => "running" }, neverAsk), request);

		expect(res.status).toBe(409);
		expect(JSON.stringify(await res.json())).toContain("running");
	});

	it("refuses a machine it has never heard of", async () => {
		const res = await ask(app({ stateOf: async () => undefined }, neverAsk), request);

		expect(res.status).toBe(404);
	});

	it("refuses a withdrawal that names where the money should go", async () => {
		const res = await ask(app(stopped, neverAsk), {
			...request,
			to: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
		});

		expect(res.status).toBe(400);
	});

	it("refuses a malformed withdrawal before it looks anything up", async () => {
		const stateOf = vi.fn(async () => "stopped" as const);

		const res = await ask(app({ stateOf }, neverAsk), { machineId });

		expect(res.status).toBe(400);
		expect(stateOf).not.toHaveBeenCalled();
	});
});

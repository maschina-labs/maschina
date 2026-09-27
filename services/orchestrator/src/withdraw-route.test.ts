import { newId } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.ts";
import type { MachineStates, Withdrawer } from "./withdraw-route.ts";

const daemonToken = "d".repeat(40);
const gatewayToken = "g".repeat(40);
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

const everythingSent = {
	status: "sent" as const,
	withdrawalId,
	to: "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu",
	signatures: ["5".repeat(88)],
	tokens: [
		{
			mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			amount: "10000000",
			from: "trading" as const,
		},
	],
	lamports: "19995000",
	leftBehind: [],
};

function app(
	states: MachineStates,
	withdrawer: Withdrawer,
	options: { gateway?: string } = { gateway: gatewayToken },
) {
	return buildApp({
		version: "1.0.0",
		daemonToken,
		...(options.gateway === undefined ? {} : { gatewayToken: options.gateway }),
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

const ask = (target: ReturnType<typeof app>, path: string, body: unknown, token = gatewayToken) =>
	target.request(path, {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});

const request = { withdrawalId, machineId, lamports: "250000000" };
const everything = { withdrawalId, machineId };
const stopped: MachineStates = { stateOf: async () => "stopped" };
const refuse = async () => {
	throw new Error("the signer must not be asked");
};
const neverAsk: Withdrawer = { withdraw: refuse, withdrawEverything: refuse };
const withdrawer = (over: Partial<Withdrawer>): Withdrawer => ({ ...neverAsk, ...over });

describe("who may ask for a machine's funds", () => {
	it("is the gateway, acting for a signed in owner", async () => {
		const withdraw = vi.fn(async () => sent);
		const res = await ask(app(stopped, withdrawer({ withdraw })), "/owner/v1/withdraw", request);

		expect(res.status).toBe(200);
	});

	it("is never a node, whose token opens the run queue and nothing about an owner's money", async () => {
		// A node could only ever have paid the owner, so nothing could be stolen. It still has no business
		// deciding when an owner's money moves.
		const target = app(stopped, neverAsk);

		expect((await ask(target, "/owner/v1/withdraw", request, daemonToken)).status).toBe(401);
		expect((await ask(target, "/internal/v1/withdraw", request, daemonToken)).status).toBe(404);
	});

	it("is nobody at all while the gateway's token is not set", async () => {
		const res = await ask(app(stopped, neverAsk, {}), "/owner/v1/withdraw", request);
		expect(res.status).toBe(404);
	});
});

describe("asking for a machine's SOL back", () => {
	it("passes it to the signer and gives the answer back unchanged", async () => {
		const withdraw = vi.fn(async () => sent);
		const res = await ask(app(stopped, withdrawer({ withdraw })), "/owner/v1/withdraw", request);

		expect(await res.json()).toEqual(sent);
		expect(withdraw).toHaveBeenCalledWith(request);
	});

	it("refuses a withdrawal that names where the money should go", async () => {
		const res = await ask(app(stopped, neverAsk), "/owner/v1/withdraw", {
			...request,
			to: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
		});
		expect(res.status).toBe(400);
	});

	it("refuses a malformed withdrawal before it looks anything up", async () => {
		const stateOf = vi.fn(async () => "stopped" as const);
		const res = await ask(app({ stateOf }, neverAsk), "/owner/v1/withdraw", { machineId });

		expect(res.status).toBe(400);
		expect(stateOf).not.toHaveBeenCalled();
	});
});

describe("asking for everything back", () => {
	it("passes it to the signer and gives the answer back unchanged", async () => {
		const withdrawEverything = vi.fn(async () => everythingSent);
		const res = await ask(
			app(stopped, withdrawer({ withdrawEverything })),
			"/owner/v1/withdraw-everything",
			everything,
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(everythingSent);
		expect(withdrawEverything).toHaveBeenCalledWith(everything);
	});

	it("works for a paused machine as well as a stopped one", async () => {
		const withdrawEverything = vi.fn(async () => everythingSent);
		const res = await ask(
			app({ stateOf: async () => "paused" }, withdrawer({ withdrawEverything })),
			"/owner/v1/withdraw-everything",
			everything,
		);
		expect(res.status).toBe(200);
	});

	it("refuses while the machine is still running, and says to stop it first", async () => {
		// A machine mid-trade has money committed. Taking the wallet out from under it would leave a
		// signed trade with nothing to pay for it.
		const res = await ask(
			app({ stateOf: async () => "running" }, neverAsk),
			"/owner/v1/withdraw-everything",
			everything,
		);

		expect(res.status).toBe(409);
		expect(JSON.stringify(await res.json())).toContain("running");
	});

	it("refuses a machine it has never heard of", async () => {
		const res = await ask(
			app({ stateOf: async () => undefined }, neverAsk),
			"/owner/v1/withdraw-everything",
			everything,
		);
		expect(res.status).toBe(404);
	});

	it("refuses a request that names more than the machine", async () => {
		const res = await ask(app(stopped, neverAsk), "/owner/v1/withdraw-everything", {
			...everything,
			lamports: "1",
		});
		expect(res.status).toBe(400);
	});
});

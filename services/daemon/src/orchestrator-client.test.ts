import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import { orchestratorClient } from "./orchestrator-client.ts";

const nodeId = newId<"node">();
const runId = newId<"run">();
const machineId = newId<"machine">();

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the orchestrator client", () => {
	it("claims a run with the node's id and the token, and reads the lease", async () => {
		const fetchFn = vi.fn(async () =>
			json({
				run: {
					id: runId,
					machineId,
					occurrenceKey: "2026-09-21T09:00",
					dueAt: "2026-09-21T09:00:00.000Z",
					leaseEpoch: "7",
					leaseExpiresAt: "2026-09-21T09:01:00.000Z",
				},
			}),
		);
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: fetchFn,
		});

		const run = await client.claim(nodeId);

		expect(run).toMatchObject({ id: runId, machineId, leaseEpoch: 7n });
		expect(run?.dueAt).toEqual(new Date("2026-09-21T09:00:00.000Z"));
		const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
		expect(String(url)).toBe("http://orchestrator:4100/internal/v1/runs/claim");
		expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
		expect(JSON.parse(String(init.body))).toEqual({ nodeId });
	});

	it("returns nothing when no run is due", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({ run: null }),
		});
		expect(await client.claim(nodeId)).toBeUndefined();
	});

	it("sends a report with the lease epoch as digits", async () => {
		const fetchFn = vi.fn(async () => json({ recorded: true }));
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: fetchFn,
		});

		const result = await client.report({
			nodeId,
			runId,
			leaseEpoch: 7n,
			event: { type: "run.started", payload: { runId, nodeId } },
		});

		expect(result).toEqual({ recorded: true });
		const [, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
		expect(JSON.parse(String(init.body))).toMatchObject({ leaseEpoch: "7" });
	});

	it("says when the node lost the run, rather than throwing", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({ error: { code: "conflict" } }, 409),
		});
		const result = await client.report({
			nodeId,
			runId,
			leaseEpoch: 7n,
			event: { type: "run.started", payload: { runId, nodeId } },
		});
		expect(result).toEqual({ recorded: false, reason: "lease_lost" });
	});

	it("throws on anything else, so the loop can back off", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({ error: {} }, 500),
		});
		await expect(client.claim(nodeId)).rejects.toThrow(/500/);
		await expect(
			client.report({
				nodeId,
				runId,
				leaseEpoch: 1n,
				event: { type: "run.started", payload: { runId, nodeId } },
			}),
		).rejects.toThrow(/500/);
	});

	it("refuses an answer that does not match the contract", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({ run: { id: "nope" } }),
		});
		await expect(client.claim(nodeId)).rejects.toThrow();
	});
});

describe("renewing a lease", () => {
	it("says the node still holds the run", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({ leaseExpiresAt: "2026-09-21T09:02:00.000Z" }),
		});
		expect(await client.renew({ nodeId, runId, leaseEpoch: 7n })).toEqual({ held: true });
	});

	it("says the run has moved on, rather than throwing", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({ error: { code: "conflict" } }, 409),
		});
		expect(await client.renew({ nodeId, runId, leaseEpoch: 7n })).toEqual({ held: false });
	});

	it("throws on an outage, so one missed beat is not taken for a lost run", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({}, 503),
		});
		await expect(client.renew({ nodeId, runId, leaseEpoch: 7n })).rejects.toThrow(/503/);
	});
});

describe("asking about a run and proposing a trade", () => {
	const context = {
		runId,
		machineId,
		wallet: "WaLLet1111111111111111111111111111111111111",
		kind: "recurring_buy",
		paper: false,
		settings: { amountPerBuy: "5" },
		dueAt: "2026-09-21T09:00:00.000Z",
		state: "running",
		canAct: true,
		availableBudget: "20000000",
		totals: { spent: "0", buys: 0 },
	};

	it("reads a run's context, with amounts back as numbers", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json(context),
		});
		const read = await client.context({ nodeId, runId, leaseEpoch: 2n });
		expect(read).toMatchObject({
			kind: "recurring_buy",
			paper: false,
			availableBudget: 20_000_000n,
			totals: { spent: 0n, buys: 0 },
		});
		expect(read?.dueAt).toEqual(new Date("2026-09-21T09:00:00.000Z"));
	});

	it("says nothing about a run it no longer holds", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({}, 409),
		});
		expect(await client.context({ nodeId, runId, leaseEpoch: 2n })).toBeUndefined();
	});

	it("passes the signer's answer back from a proposal", async () => {
		const answer = { status: "signed", proposalId: newId<"proposal">(), signature: "5".repeat(88) };
		const fetchFn = vi.fn(async () => json(answer));
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: fetchFn,
		});

		const proposal = { proposalId: answer.proposalId } as unknown as Parameters<
			typeof client.propose
		>[0]["proposal"];
		expect(await client.propose({ nodeId, leaseEpoch: 2n, proposal })).toEqual(answer);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
		expect(String(url)).toBe("http://orchestrator:4100/internal/v1/runs/propose");
		expect(JSON.parse(String(init.body))).toMatchObject({ leaseEpoch: "2" });
	});

	it("says the run moved on when a proposal comes too late", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({}, 409),
		});
		const proposal = {} as Parameters<typeof client.propose>[0]["proposal"];
		expect(await client.propose({ nodeId, leaseEpoch: 2n, proposal })).toBe("lease_lost");
	});

	it("throws on a failure it cannot act on", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({}, 503),
		});
		await expect(client.renew({ nodeId, runId, leaseEpoch: 7n })).rejects.toThrow(/503/);
		await expect(client.context({ nodeId, runId, leaseEpoch: 2n })).rejects.toThrow(/503/);
		const proposal = {} as Parameters<typeof client.propose>[0]["proposal"];
		await expect(client.propose({ nodeId, leaseEpoch: 2n, proposal })).rejects.toThrow(/503/);
	});
});

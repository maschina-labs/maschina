import { newId, ok } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import { paperSigner } from "./paper-signer.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const request = {
	proposalId: newId<"proposal">(),
	runId: newId<"run">(),
	tradeId: newId<"trade">(),
	machineId: newId<"machine">(),
	wallet: SOL,
	trade: {
		inputMint: USDC,
		outputMint: SOL,
		inputAmount: "5000000",
		quotedOutputAmount: "45000000",
		slippageBps: 50,
	},
} as unknown as Parameters<ReturnType<typeof paperSigner>["simulate"]>[0];

type Written = {
	machineId: string;
	type: string;
	payload: Record<string, unknown>;
	leaseEpoch: bigint;
};

const ports = () => {
	const record = vi.fn(async (_event: Written) => ok(true));
	return { record, signer: paperSigner({ record }) };
};

describe("a machine on paper", () => {
	it("says the trade was simulated rather than signed", async () => {
		const { signer } = ports();

		expect(await signer.simulate(request, 1n)).toEqual({
			status: "simulated",
			proposalId: request.proposalId,
			tradeId: request.tradeId,
		});
	});

	it("writes the intent and the outcome, so the budget moves exactly as it would with money", async () => {
		const { record, signer } = ports();
		await signer.simulate(request, 1n);

		expect(record).toHaveBeenCalledTimes(2);
		expect(record.mock.calls[0]?.[0]).toMatchObject({ type: "trade.intended" });
		expect(record.mock.calls[1]?.[0]).toMatchObject({
			type: "trade.simulated",
			payload: { inputAmount: "5000000", quotedOutputAmount: "45000000" },
		});
	});

	it("records against the machine that proposed it and no other", async () => {
		const { record, signer } = ports();
		await signer.simulate(request, 1n);

		for (const call of record.mock.calls) {
			expect(call[0]).toMatchObject({ machineId: request.machineId });
		}
	});

	it("writes under the lease the node holds, so the record's fencing accepts it", async () => {
		const { record, signer } = ports();
		// Writing under a lower epoch than the run's own events is a stale write, and the record is right
		// to refuse it. A simulated trade is written by the node that holds the run, at its epoch.
		await signer.simulate(request, 4n);

		for (const call of record.mock.calls) {
			expect(call[0]).toMatchObject({ leaseEpoch: 4n });
		}
	});

	it("never claims a signature", async () => {
		const { signer } = ports();
		const answer = await signer.simulate(request, 1n);

		expect(JSON.stringify(answer)).not.toContain("signature");
	});
});

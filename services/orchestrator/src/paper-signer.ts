/**
 * A machine running on paper.
 *
 * It answers the same question the signer answers, and it never signs anything. The trade is priced,
 * held against the budget and written into the record exactly as a real one would be, then the chain
 * is skipped. An owner reads the record afterwards and sees what the machine would have done.
 *
 * It takes a request with no transaction in it, because there is nothing to sign. That is what keeps
 * paper honest: the signer could not act on this even if it were handed one by mistake.
 */

import type { SignResponse, SimulateRequest } from "@maschina/contracts";
import type { MaschinaError, Result } from "@maschina/core";

export type PaperPorts = {
	/** Writes to the record, the same way every other event is written. */
	record(event: {
		machineId: string;
		type: "trade.intended" | "trade.simulated";
		payload: Record<string, unknown>;
		/** The run whose lease permits the write. The record checks it is still held. */
		runId: string;
		leaseEpoch: bigint;
	}): Promise<Result<unknown, MaschinaError>>;
};

export function paperSigner(ports: PaperPorts) {
	/**
	 * Written under the lease the node holds, not under nothing.
	 *
	 * The record fences on the run's lease: a write is accepted only while the run is still held at
	 * exactly the epoch named. A node that was replaced holds nothing and is refused. A simulated
	 * trade is written by the node running the machine right now, so it names that run like every
	 * other event.
	 */
	return {
		async simulate(request: SimulateRequest, leaseEpoch: bigint): Promise<SignResponse> {
			const { trade } = request;

			const intended = await ports.record({
				machineId: request.machineId,
				type: "trade.intended",
				runId: request.runId,
				leaseEpoch,
				payload: {
					runId: request.runId,
					tradeId: request.tradeId,
					inputMint: trade.inputMint,
					outputMint: trade.outputMint,
					inputAmount: trade.inputAmount,
					quotedOutputAmount: trade.quotedOutputAmount,
					slippageBps: trade.slippageBps,
				},
			});
			if (!intended.ok) throw intended.error;

			// Written straight after, because nothing can happen between the two: no signature, no send,
			// no chance of landing late. On paper the intent and the outcome are the same moment.
			const simulated = await ports.record({
				machineId: request.machineId,
				type: "trade.simulated",
				runId: request.runId,
				leaseEpoch,
				payload: {
					runId: request.runId,
					tradeId: request.tradeId,
					inputMint: trade.inputMint,
					outputMint: trade.outputMint,
					inputAmount: trade.inputAmount,
					quotedOutputAmount: trade.quotedOutputAmount,
				},
			});
			if (!simulated.ok) throw simulated.error;

			return { status: "simulated", proposalId: request.proposalId, tradeId: request.tradeId };
		},
	};
}

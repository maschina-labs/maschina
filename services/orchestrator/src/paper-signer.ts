/**
 * A machine running on paper.
 *
 * It answers the same question the signer answers, and it never signs anything. The trade is priced,
 * held against the budget and written into the record exactly as a real one would be, then the chain
 * is skipped. An owner reads the record afterwards and sees what the machine would have done.
 *
 * It lives behind the signer's own interface on purpose. Nothing upstream knows which one it is talking
 * to, so a machine on paper takes exactly the path a machine with money takes, and there is no separate
 * code path to drift.
 */

import type { SignRequest, SignResponse } from "@maschina/contracts";
import type { MaschinaError, Result } from "@maschina/core";

export type PaperPorts = {
	/** Writes to the record, the same way every other event is written. */
	record(event: {
		machineId: string;
		type: "trade.intended" | "trade.simulated";
		payload: Record<string, unknown>;
	}): Promise<Result<unknown, MaschinaError>>;
};

export function paperSigner(ports: PaperPorts) {
	return {
		async sign(request: SignRequest): Promise<SignResponse> {
			const { trade } = request;

			const intended = await ports.record({
				machineId: request.machineId,
				type: "trade.intended",
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

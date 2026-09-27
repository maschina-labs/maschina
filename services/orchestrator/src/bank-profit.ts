/**
 * Asking the signer, now and then, whether any machine has profit to bank.
 *
 * The orchestrator does not decide what is due. It knows which machines could be swept, and asks; the
 * signer reads the chain and the record and says whether anything moves. Most answers are "not due",
 * which is the system working and is not worth a log line above debug.
 *
 * Three rules keep it from ever banking the same profit twice:
 *
 *   - A machine with a sweep still open is asked about that sweep, by its id, so the signer finishes it
 *     from the decision it recorded instead of deciding again.
 *   - A machine with a run in progress is left alone until the run is done, so a sweep never reads a
 *     float while a trade is moving it.
 *   - The interval is longer than a transaction can stay valid, so by the next look anything sent has
 *     either landed or expired.
 */

import type { SweepRequest, SweepResponse } from "@maschina/contracts";
import { newId } from "@maschina/core";
import type { Logger } from "@maschina/telemetry";

/** Five minutes: well past the two or so a transaction's blockhash stays valid. */
export const DEFAULT_SWEEP_EVERY_MS = 5 * 60_000;

type SweepCandidate = {
	machineId: string;
	/** A sweep that was sent and never finished, which is finished before anything new is decided. */
	openSweepId?: string | undefined;
};

export type BankProfitPorts = {
	candidates(): Promise<SweepCandidate[]>;
	sweep(request: SweepRequest): Promise<SweepResponse>;
	logger: Pick<Logger, "debug" | "info" | "warn" | "error">;
	sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
	everyMs?: number;
};

const pause = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		if (signal.aborted) return resolve();
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});

/** One look at every machine that could be swept. Exported so a single pass can be tested. */
export async function sweepOnce(ports: BankProfitPorts): Promise<void> {
	const { logger } = ports;
	for (const candidate of await ports.candidates()) {
		const sweepId = candidate.openSweepId ?? newId<"sweep">();
		try {
			const answer = await ports.sweep({ sweepId, machineId: candidate.machineId });
			if (answer.status === "swept") {
				logger.info(
					{
						machineId: candidate.machineId,
						sweepId,
						amount: answer.amount,
						signature: answer.signature,
					},
					"profit above the float was banked in the vault",
				);
			} else if (answer.status === "not_due") {
				logger.debug(
					{ machineId: candidate.machineId, because: answer.because },
					"nothing to bank",
				);
			} else {
				logger.warn(
					{ machineId: candidate.machineId, sweepId, rule: answer.rule, reason: answer.reason },
					"a sweep was refused",
				);
			}
		} catch (error) {
			// One machine's trouble is not a reason to skip the rest.
			logger.warn(
				{ err: error, machineId: candidate.machineId, sweepId },
				"could not ask about a sweep",
			);
		}
	}
}

/** Runs until `signal` aborts. */
export async function bankProfit(ports: BankProfitPorts, signal: AbortSignal): Promise<void> {
	const sleep = ports.sleep ?? pause;
	const everyMs = ports.everyMs ?? DEFAULT_SWEEP_EVERY_MS;
	while (!signal.aborted) {
		try {
			await sweepOnce(ports);
		} catch (error) {
			ports.logger.warn({ err: error }, "could not list the machines to sweep");
		}
		await sleep(everyMs, signal);
	}
}

/**
 * Finding out whether a transaction landed.
 *
 * There are only four honest answers, and the difference between them is the difference between a
 * machine that retries safely and one that buys twice:
 *
 *   landed    the chain has it, and it worked
 *   failed    the chain has it, and it failed. It happened, and it cost a fee
 *   expired   it can never land now, because the block it was built against is long gone
 *   unknown   we do not know yet. Nothing is retried on this answer
 *
 * "The node has never heard of it" is not one of them. A node only keeps recent signatures in memory, so
 * a transaction from an hour ago reads as missing unless the node is asked to search its history. That
 * is why absence is only ever proof when the transaction's own expiry has passed: after that, no
 * validator will accept it, so it did not happen and never will.
 */

import { MaschinaError } from "@maschina/core";

export const COMMITMENTS = ["processed", "confirmed", "finalized"] as const;
export type Commitment = (typeof COMMITMENTS)[number];

const RANK: Record<Commitment, number> = { processed: 0, confirmed: 1, finalized: 2 };

/** True when a status is at least as settled as the one asked for. */
export const isAtLeast = (status: Commitment, wanted: Commitment): boolean =>
	RANK[status] >= RANK[wanted];

export type SignatureStatus = {
	slot: bigint;
	commitment: Commitment;
	/** Set when the transaction landed and then failed. It still happened, and it still cost a fee. */
	error?: string;
};

export type ConfirmationReader = {
	/**
	 * The status of a signature, or nothing when the node has no record of it.
	 * `searchHistory` makes the node look past its recent cache, which is slower and necessary for
	 * anything older than a couple of minutes.
	 */
	statusOf(signature: string, searchHistory: boolean): Promise<SignatureStatus | undefined>;
	/** The current block height, which is the only way to know a transaction has expired. */
	blockHeight(): Promise<bigint>;
};

export type Confirmation =
	| { outcome: "landed"; signature: string; slot: bigint; commitment: Commitment }
	| { outcome: "failed"; signature: string; slot: bigint; error: string }
	| { outcome: "expired"; signature: string; because: string }
	| { outcome: "unknown"; signature: string; because: string };

export type ConfirmRequest = {
	signature: string;
	/** The height the transaction was built to expire at. Past this, it can never land. */
	lastValidBlockHeight: bigint;
	/** How settled the answer has to be before a trade counts as done. */
	wait?: Commitment;
};

export type ConfirmOptions = {
	/** How long to keep asking before giving up and saying so. */
	timeoutMs?: number;
	/** How long to wait between questions. */
	pollMs?: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
};

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_POLL_MS = 1000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Waits for a transaction to settle, and never guesses.
 *
 * Every time round it asks two questions in the same order: has the chain seen this, and has the
 * transaction expired. Asking in that order matters. A transaction can land in the same moment its
 * blockhash expires, so the status is read first and expiry is only believed when there is still no
 * record of the signature.
 */
export async function confirmSignature(
	reader: ConfirmationReader,
	request: ConfirmRequest,
	options: ConfirmOptions = {},
): Promise<Confirmation> {
	const { signature, lastValidBlockHeight } = request;
	const wanted = request.wait ?? "confirmed";
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
	const sleep = options.sleep ?? wait;
	const now = options.now ?? Date.now;

	if (timeoutMs <= 0 || pollMs <= 0) {
		throw new MaschinaError("invalid_input", "waiting needs a timeout and an interval above zero");
	}

	const startedAt = now();

	for (;;) {
		const status = await reader.statusOf(signature, false);

		if (status) {
			if (status.error !== undefined) {
				return { outcome: "failed", signature, slot: status.slot, error: status.error };
			}
			if (isAtLeast(status.commitment, wanted)) {
				return { outcome: "landed", signature, slot: status.slot, commitment: status.commitment };
			}
		} else {
			const height = await reader.blockHeight();
			if (height > lastValidBlockHeight) {
				// Before saying a transaction did not happen, ask the node to search its history. Its
				// recent cache is short, so a transaction that landed a while ago, or one being confirmed
				// after a restart, reads as missing there and would otherwise be declared dead.
				const settled = await reader.statusOf(signature, true);
				if (settled) {
					if (settled.error !== undefined) {
						return { outcome: "failed", signature, slot: settled.slot, error: settled.error };
					}
					return {
						outcome: "landed",
						signature,
						slot: settled.slot,
						commitment: settled.commitment,
					};
				}
				// Nothing knows this signature and no validator will accept it now. It did not happen.
				return {
					outcome: "expired",
					signature,
					because: `the block it was built against passed at height ${lastValidBlockHeight}`,
				};
			}
		}

		if (now() - startedAt >= timeoutMs) {
			return {
				outcome: "unknown",
				signature,
				because: `still waiting after ${Math.round(timeoutMs / 1000)} seconds`,
			};
		}

		await sleep(pollMs);
	}
}

/**
 * Asks the chain about a signature from a run that stopped before it recorded an outcome.
 *
 * This is the recovery path, so it searches the node's history rather than its recent cache, and it
 * treats a missing signature as an answer only when the expiry has passed. Everything else is unknown,
 * which is the answer that stops rather than retries.
 */
export async function didItLand(
	reader: ConfirmationReader,
	signature: string,
	lastValidBlockHeight?: bigint,
): Promise<Confirmation> {
	const status = await reader.statusOf(signature, true);

	if (status) {
		if (status.error !== undefined) {
			return { outcome: "failed", signature, slot: status.slot, error: status.error };
		}
		return { outcome: "landed", signature, slot: status.slot, commitment: status.commitment };
	}

	if (lastValidBlockHeight !== undefined) {
		const height = await reader.blockHeight();
		if (height > lastValidBlockHeight) {
			return {
				outcome: "expired",
				signature,
				because: "the chain has no record of it and it can no longer land",
			};
		}
	}

	return {
		outcome: "unknown",
		signature,
		because: "the chain has no record of it yet, and it has not expired",
	};
}

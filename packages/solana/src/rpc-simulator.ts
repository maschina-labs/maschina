/**
 * Running a transaction through an RPC node without sending it.
 *
 * Kept apart from `rpc.ts` because this is the one reader whose answer decides whether money moves,
 * and apart from `simulate-effects.ts` because that file is the logic and this is the wire.
 *
 * Three things are deliberate:
 *
 *   - **`sigVerify: false` and `replaceRecentBlockhash: true`.** The transaction has not been signed
 *     yet; that is the whole point of asking. The node is asked what these instructions would do,
 *     not whether a signature is valid.
 *   - **`jsonParsed` accounts.** The same encoding `readBalances` uses, so one decoder serves the
 *     before and the after, and the two readings cannot disagree about what a balance means.
 *   - **A missing answer is a refusal, never an empty one.** A node that returns no accounts has
 *     told us nothing, and nothing must never be read as a transaction that changed nothing.
 */

import type { SolanaRpc } from "./rpc.ts";
import type { Simulated, SimulateTransaction } from "./simulate-effects.ts";

/** Just enough of the node's answer to measure a wallet. */
type SimulatedAccount = { lamports: bigint | number; owner: string; data: unknown } | null;

export function rpcSimulator(rpc: SolanaRpc): SimulateTransaction {
	return async (transaction, wallet, addresses): Promise<Simulated> => {
		const encoded = Buffer.from(transaction).toString("base64");
		const answer = (await rpc
			.simulateTransaction(
				encoded as Parameters<SolanaRpc["simulateTransaction"]>[0],
				{
					encoding: "base64",
					sigVerify: false,
					replaceRecentBlockhash: true,
					accounts: {
						encoding: "jsonParsed",
						addresses: addresses as Parameters<SolanaRpc["getBalance"]>[0][],
					},
				} as never,
			)
			.send()) as { value?: { err?: unknown; accounts?: SimulatedAccount[] | null } };

		const value = answer.value;
		if (value?.err) {
			return { ok: false, problem: `the chain refused it: ${JSON.stringify(value.err)}` };
		}

		const returned = value?.accounts;
		if (!Array.isArray(returned) || returned.length !== addresses.length) {
			return {
				ok: false,
				problem: "the node did not say what the accounts would hold, so nothing was measured",
			};
		}

		// The node answers positionally, so each account is paired back to what was asked about.
		const accounts = [];
		let lamports: bigint | undefined;
		for (const [index, account] of returned.entries()) {
			const address = addresses[index];
			if (!account || address === undefined) continue;
			if (address === wallet) lamports = BigInt(account.lamports);
			accounts.push({ address, owner: account.owner, data: account.data });
		}

		if (lamports === undefined) {
			return {
				ok: false,
				problem: "the node did not say what the wallet itself would hold, so nothing was measured",
			};
		}

		return { ok: true, lamports, accounts };
	};
}

/**
 * Building the transaction that funds a machine from its owner's wallet.
 *
 * It is read back before it leaves: exactly the dollars asked for, from the owner's account into the
 * machine's, and exactly the SOL asked for, into the machine's wallet, paid by the owner. Anything else
 * and nothing is handed to the wallet to approve.
 */

import type { FundingTransaction } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import {
	type BlockhashReader,
	buildFunding,
	parseAddress,
	readFunding,
	TOKEN_PROGRAM,
	tokenAccountFor,
} from "@maschina/solana";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function fundingTransaction(
	blockhashes: BlockhashReader,
	request: { ownerWallet: string; machineWallet: string; usdc: bigint; lamports: bigint },
): Promise<FundingTransaction> {
	const owner = parseAddress(request.ownerWallet);
	const machine = parseAddress(request.machineWallet);
	const mint = parseAddress(USDC);
	const { blockhash, lastValidBlockHeight } = await blockhashes.latest();
	const bytes = await buildFunding({
		owner,
		machine,
		token:
			request.usdc > 0n
				? { mint, amount: request.usdc, decimals: 6, program: TOKEN_PROGRAM }
				: undefined,
		lamports: request.lamports,
		blockhash,
		lastValidBlockHeight,
	});

	const facts = await readFunding(bytes);
	const into = await tokenAccountFor({ owner: machine, mint, tokenProgram: TOKEN_PROGRAM });
	const right =
		facts.payer === owner &&
		(request.usdc === 0n || (facts.token?.to === into && facts.token.amount === request.usdc)) &&
		(request.lamports === 0n ||
			(facts.sol?.to === machine && facts.sol.lamports === request.lamports));
	if (!right) {
		throw new MaschinaError("internal", "the funding transaction did not read back as asked");
	}

	return {
		transaction: Buffer.from(bytes).toString("base64"),
		lastValidBlockHeight: lastValidBlockHeight.toString(),
	};
}

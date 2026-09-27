/**
 * What a swap's own instructions are allowed to do with the machine's money.
 *
 * A swap moves tokens inside the router's instruction, by the router's own program, along a route it
 * chose. Everything around that instruction is plumbing: making the account the swap receives into,
 * wrapping SOL before selling it, closing the wrapped account afterwards. The plumbing is where a
 * transaction that looks like a swap could quietly move money somewhere a swap never would, and the
 * wallet provider cannot tell the difference, because a swap's token destinations cannot be named in
 * advance (#667).
 *
 * So the plumbing is held to exactly what a swap needs, and everything else is refused:
 *
 *   system     one kind of instruction: SOL into the wallet's own wrapped SOL account
 *   token      sync a wrapped account, or close an account back into the wallet
 *   associated make the wallet's own account for a token, paid for by the wallet
 *
 * A bare token transfer, a delegation, a change of owner, funding a new account: none of these is part
 * of a swap, and every one of them is a way to drain one. An account that cannot be read, because it
 * lives in a lookup table, is treated as somebody else's, which is the safe way round.
 *
 * Refusing by default means a new shape of route will be refused until somebody looks at it. That costs
 * a trade. The other way round costs the wallet.
 *
 * What is inside the router's instruction is not checked here. Where a route sends its output is a
 * separate question, recorded in `internal` as the next thing this check has to learn.
 */

import { MaschinaError } from "@maschina/core";
import {
	getCompiledTransactionMessageDecoder,
	getTransactionDecoder,
	type Address as KitAddress,
} from "@solana/kit";
import type { Address } from "./address.ts";
import {
	ASSOCIATED_TOKEN_PROGRAM,
	TOKEN_2022_PROGRAM,
	TOKEN_PROGRAM,
	tokenAccountFor,
} from "./token-account.ts";
import { WRAPPED_SOL } from "./trade-cost.ts";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

/** System program: move lamports. */
const SYSTEM_TRANSFER = 2;
/** Token program: close an account, paying its lamports to a destination. */
const TOKEN_CLOSE_ACCOUNT = 9;
/** Token program: bring a wrapped SOL account's token balance up to its lamports. */
const TOKEN_SYNC_NATIVE = 17;
/** Associated token program: create, and create unless it already exists. */
const ASSOCIATED_CREATE = 0;
const ASSOCIATED_CREATE_IDEMPOTENT = 1;

// A declaration rather than an arrow, so the compiler knows nothing runs after a refusal.
function refuse(message: string, details: Record<string, unknown> = {}): never {
	throw new MaschinaError("forbidden", message, { details });
}

/** Refuses a transaction whose plumbing does anything a swap from this wallet does not need. */
export async function checkSwapInstructions(
	transaction: Uint8Array,
	wallet: Address,
): Promise<void> {
	const decoded = getTransactionDecoder().decode(transaction);
	const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
	if (!("instructions" in message)) {
		refuse("the transaction is in a format Maschina does not read");
	}
	const keys = message.staticAccounts as readonly KitAddress[];
	const wrapped = await tokenAccountFor({ owner: wallet, mint: WRAPPED_SOL });

	for (const instruction of message.instructions) {
		const program = keys[instruction.programAddressIndex];
		const data = instruction.data ?? new Uint8Array();
		/** An account the instruction names, or nothing when it lives in a lookup table. */
		const account = (position: number): string | undefined => {
			const index = instruction.accountIndices?.[position];
			return index === undefined ? undefined : keys[index];
		};

		if (program === SYSTEM_PROGRAM) {
			const kind =
				data.length >= 4 ? new DataView(data.buffer, data.byteOffset).getUint32(0, true) : -1;
			if (kind !== SYSTEM_TRANSFER) {
				refuse("the transaction asks the system program for something a swap has no use for", {
					kind,
				});
			}
			if (account(0) !== wallet || account(1) !== wrapped) {
				refuse("the transaction moves SOL somewhere other than the wallet's own wrapped account", {
					to: account(1),
				});
			}
			continue;
		}

		if (program === TOKEN_PROGRAM || program === TOKEN_2022_PROGRAM) {
			const kind = data[0];
			if (kind === TOKEN_SYNC_NATIVE) continue;
			if (kind === TOKEN_CLOSE_ACCOUNT) {
				// Closing pays out every lamport in the account, which for wrapped SOL is the SOL itself.
				if (account(1) !== wallet) {
					refuse("the transaction closes an account into somebody else's wallet", {
						to: account(1),
					});
				}
				continue;
			}
			refuse("the transaction moves or hands over tokens outside the swap itself", { kind });
		}

		if (program === ASSOCIATED_TOKEN_PROGRAM) {
			// The original create instruction carries no data at all.
			const kind = data.length === 0 ? ASSOCIATED_CREATE : data[0];
			if (kind !== ASSOCIATED_CREATE && kind !== ASSOCIATED_CREATE_IDEMPOTENT) {
				refuse("the transaction asks the associated token program for something a swap does not", {
					kind,
				});
			}
			if (account(0) !== wallet || account(2) !== wallet) {
				refuse("the transaction makes a token account for somebody other than this wallet", {
					owner: account(2),
				});
			}
		}
		// Compute budget is held to the fee allowance elsewhere, and the program list is checked before
		// this runs. The router's own instruction is the swap.
	}
}

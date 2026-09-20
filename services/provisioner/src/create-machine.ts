/**
 * Creating a machine.
 *
 * A machine is not a machine until it has a wallet with a policy on it, so the order here is the whole
 * point:
 *
 *   make the wallet  ->  read its policy back  ->  only then write the machine
 *
 * If the wallet cannot be made, or the policy that came back is not the one that was asked for, no
 * machine is written. The alternative is a row in the record with money behind it and nothing holding
 * it, which is the failure this whole system exists to prevent.
 *
 * The policy itself is narrow on purpose: funds go to the owner and nowhere else, the machine may only
 * touch tokens the owner approved, and it may only call the programs a swap calls.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import { SWAP_PROGRAMS } from "@maschina/solana";
import {
	isSolanaAddress,
	toMaschinaError,
	type WalletPolicy,
	type WalletProvider,
} from "@maschina/wallet";

export type MachineRequest = {
	ownerWallet: string;
	name: string;
	kind: string;
	settings: Record<string, unknown>;
	rules?: Record<string, unknown>;
	limits: {
		budgetGranted: bigint;
		maxPerTrade?: bigint;
		maxPerDay?: bigint;
		approvedMints: readonly string[];
	};
};

type WrittenMachine = {
	machineId: string;
	ownerId: string;
	walletAddress: string;
	definitionId: string;
};

export type CreateMachinePorts = {
	provider: WalletProvider;
	/** Writes the whole machine, or none of it. */
	write(machine: {
		ownerWallet: string;
		name: string;
		kind: string;
		settings: Record<string, unknown>;
		rules: Record<string, unknown>;
		wallet: { address: string; providerWalletId: string; provider: string };
		limits: MachineRequest["limits"];
	}): Promise<Result<WrittenMachine, MaschinaError>>;
};

export type CreatedMachine = WrittenMachine & { providerWalletId: string };

/** The most SOL one transfer may move: the machine's whole budget, never more. */
const transferLimit = (budget: bigint) => budget;

export async function createMachine(
	ports: CreateMachinePorts,
	request: MachineRequest,
): Promise<Result<CreatedMachine, MaschinaError>> {
	if (!isSolanaAddress(request.ownerWallet)) {
		return err(new MaschinaError("invalid_input", "that is not a Solana address"));
	}

	const wanted: WalletPolicy = {
		owner: request.ownerWallet,
		// Nobody else, ever. A machine that pays others is given recipients deliberately, later.
		recipients: [],
		approvedPrograms: Object.keys(SWAP_PROGRAMS).sort(),
		approvedMints: [...request.limits.approvedMints].sort(),
		maxLamportsPerTransfer: transferLimit(request.limits.budgetGranted),
	};

	const created = await ports.provider.createWallet({ label: request.name, policy: wanted });
	if (!created.ok) return err(toMaschinaError(created.error));

	// The policy is read back from the provider rather than assumed: what it kept is what will be
	// enforced, and anything else means the wallet is not safe to put money behind.
	const stored = await ports.provider.readPolicy(created.value.walletId);
	if (!stored.ok) return err(toMaschinaError(stored.error));
	const problem = differsFrom(wanted, stored.value);
	if (problem) {
		return err(
			new MaschinaError("internal", `the wallet's policy is not what was asked for: ${problem}`, {
				details: { walletId: created.value.walletId },
			}),
		);
	}

	const written = await ports.write({
		ownerWallet: request.ownerWallet,
		name: request.name,
		kind: request.kind,
		settings: request.settings,
		rules: request.rules ?? {},
		wallet: {
			address: created.value.address,
			providerWalletId: created.value.walletId,
			provider: ports.provider.name,
		},
		limits: request.limits,
	});
	if (!written.ok) return written;

	return ok({ ...written.value, providerWalletId: created.value.walletId });
}

/** What, if anything, the stored policy got wrong. */
function differsFrom(wanted: WalletPolicy, stored: WalletPolicy): string | undefined {
	if (stored.owner !== wanted.owner) return "the owner is not the one asked for";
	if (stored.recipients.length !== 0) return "it allows recipients nobody asked for";
	if (stored.approvedMints.join(",") !== wanted.approvedMints.join(",")) {
		return "the approved tokens are not the ones asked for";
	}
	if (stored.maxLamportsPerTransfer > wanted.maxLamportsPerTransfer) {
		return "it allows a larger transfer than asked for";
	}
	return undefined;
}

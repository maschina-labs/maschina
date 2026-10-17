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
 *
 * Every machine is made with a vault beside it, which is where its profit goes to be out of reach. The
 * vault's policy is narrower still: it can call no router, so its key cannot sign a trade, and it can pay
 * tokens only into the owner's own accounts. Its policy is read back and checked with the same suspicion
 * as the machine's, because a vault that could trade is worse than no vault: it looks like protection.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import { checkMachineSettings, KNOWN_KINDS } from "@maschina/runtime";
import {
	newPaperAddress,
	SWAP_PROGRAMS,
	TOKEN_2022_PROGRAM,
	TOKEN_PROGRAM,
	TRANSFER_PROGRAMS,
	tokenAccountFor,
} from "@maschina/solana";
import {
	isSolanaAddress,
	toMaschinaError,
	type WalletPolicy,
	type WalletProvider,
} from "@maschina/wallet";

export type MachineRequest = {
	/** Who it belongs to. Always known: the owner row exists before anyone reaches this. */
	ownerId: string;
	/**
	 * The owner's own wallet, the only address a machine's funds can ever reach. Required for a
	 * machine that holds real money, because the provider's policy pins payouts to it. A paper
	 * machine has no funds and no policy, so somebody who has never linked a wallet can still have one.
	 */
	ownerWallet?: string | undefined;
	name: string;
	kind: string;
	/** Whether this machine only ever pretends to trade. Never inferred, always said. */
	paper: boolean;
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
		ownerId: string;
		name: string;
		kind: string;
		settings: Record<string, unknown>;
		rules: Record<string, unknown>;
		/** Carried all the way through, never defaulted anywhere along the way. */
		paper: boolean;
		wallet: {
			address: string;
			/** A paper machine has nowhere to bank, because it never earns anything. */
			vaultAddress?: string | undefined;
			providerWalletId: string;
			provider: string;
		};
		limits: MachineRequest["limits"];
	}): Promise<Result<WrittenMachine, MaschinaError>>;
};

export type CreatedMachine = WrittenMachine & { providerWalletId: string };

/**
 * The most SOL one transfer may move.
 *
 * It used to be the machine's budget, which is a different quantity in different units: a budget is base
 * units of whatever the machine spends, usually USDC at six decimals, and this is lamports at nine. A
 * machine funded with fifty dollars was given a cap of 0.05 SOL, which nobody chose and which was far
 * too small to take its funds back in one go. Turnkey refused the first real withdrawal because of it.
 *
 * It is a constant now because it cannot be derived from anything here. Note what it is and is not for:
 * the only address these funds can ever reach is the owner's, enforced by the same policy, so a tight
 * cap protects nobody and strands money. This bounds a runaway bug, and the destination restriction is
 * what stops theft.
 */
export const MAX_LAMPORTS_PER_TRANSFER = 1_000_000_000_000n;

/**
 * What a paper machine's wallet says holds it: nobody. The database has the matching check, so a
 * machine holding real money can never carry this however this code behaves.
 */
const PAPER_PROVIDER = "paper";

export async function createMachine(
	ports: CreateMachinePorts,
	request: MachineRequest,
): Promise<Result<CreatedMachine, MaschinaError>> {
	// Before a wallet exists, because a wallet is where money goes. A machine that could never trade is
	// refused while refusing costs nothing, not after it has been funded.
	const works = checkMachineSettings(KNOWN_KINDS, {
		kind: request.kind,
		settings: request.settings,
		approvedMints: request.limits.approvedMints,
	});
	if (!works.ok) return err(new MaschinaError("invalid_input", works.problem));

	// A machine on paper never signs, so it is given no wallet at the provider: no keys, no vault, no
	// policies, nothing to pay for. Its address is generated and its key dropped on the spot, so it
	// cannot sign because the key is gone rather than because something refuses. This is also what
	// lets somebody who has never linked a wallet try Maschina at all.
	if (request.paper) {
		const address = await newPaperAddress();
		const written = await ports.write({
			ownerId: request.ownerId,
			name: request.name,
			kind: request.kind,
			settings: request.settings,
			rules: request.rules ?? {},
			paper: true,
			wallet: { address, providerWalletId: `paper:${address}`, provider: PAPER_PROVIDER },
			limits: request.limits,
		});
		if (!written.ok) return written;
		return ok({ ...written.value, providerWalletId: `paper:${address}` });
	}

	// Everything below holds real money. The owner's own wallet is what the provider's policy pins
	// payouts to, so without one there is nowhere safe for the funds to go and no machine is made.
	if (request.ownerWallet === undefined || !isSolanaAddress(request.ownerWallet)) {
		return err(new MaschinaError("invalid_input", "that is not a Solana address"));
	}
	const ownerWallet = request.ownerWallet;

	const wanted: WalletPolicy = {
		owner: ownerWallet,
		// Nobody else, ever. A machine that pays others is given recipients deliberately, later.
		recipients: [],
		approvedPrograms: Object.keys(SWAP_PROGRAMS).sort(),
		approvedMints: [...request.limits.approvedMints].sort(),
		// A machine that trades cannot say where its tokens go: a swap routes them through pool accounts
		// that only exist once the route is chosen. What stops a token leaving to a stranger is the shape
		// of the transaction, which is Maschina's own check and not the provider's (#667). A vault is the
		// other case, and names its one destination.
		tokenDestinations: "any",
		// Selling SOL wraps it first, with a plain transfer into the machine's own wrapped SOL account.
		// Without this Turnkey signs every buy and refuses every sale, which the real one did (M28).
		wrapsSol: true,
		maxLamportsPerTransfer: MAX_LAMPORTS_PER_TRANSFER,
	};

	const vault: WalletPolicy = {
		owner: ownerWallet,
		recipients: [],
		approvedPrograms: Object.keys(TRANSFER_PROGRAMS).sort(),
		approvedMints: wanted.approvedMints,
		tokenDestinations: await ownerAccountsFor(ownerWallet, wanted.approvedMints),
		// A vault never sells anything, so it has no reason to move SOL anywhere but home.
		wrapsSol: false,
		maxLamportsPerTransfer: MAX_LAMPORTS_PER_TRANSFER,
	};

	const created = await ports.provider.createWallet({
		label: request.name,
		policy: wanted,
		vault,
	});
	if (!created.ok) return err(toMaschinaError(created.error));
	const { vaultAddress } = created.value;
	if (vaultAddress === undefined) {
		return err(new MaschinaError("internal", "the wallet was made without its vault"));
	}

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

	const storedVault = await ports.provider.readPolicy(created.value.walletId, "vault");
	if (!storedVault.ok) return err(toMaschinaError(storedVault.error));
	const vaultProblem = vaultDiffersFrom(vault, storedVault.value);
	if (vaultProblem) {
		return err(
			new MaschinaError(
				"internal",
				`the vault's policy is not what was asked for: ${vaultProblem}`,
				{ details: { walletId: created.value.walletId } },
			),
		);
	}

	const written = await ports.write({
		ownerId: request.ownerId,
		name: request.name,
		kind: request.kind,
		settings: request.settings,
		rules: request.rules ?? {},
		paper: request.paper,
		wallet: {
			address: created.value.address,
			vaultAddress,
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
	if (stored.wrapsSol !== wanted.wrapsSol) {
		// Not a leak, and still a machine nobody should fund: it could buy and never sell.
		return "it cannot wrap SOL, so it could never sell what it buys";
	}
	if (stored.maxLamportsPerTransfer > wanted.maxLamportsPerTransfer) {
		return "it allows a larger transfer than asked for";
	}
	return undefined;
}

/**
 * The owner's own account for every approved token, under both token programs.
 *
 * Which program a mint belongs to is a fact on chain, and the provisioner does not read the chain. Naming
 * the owner's account under both is exact rather than generous: each is derived from the owner's own
 * address, so a vault allowed to pay either can still only ever pay the owner. The one that does not
 * apply to a given token simply never exists.
 */
async function ownerAccountsFor(owner: string, mints: readonly string[]): Promise<string[]> {
	const accounts = await Promise.all(
		mints.flatMap((mint) =>
			[TOKEN_PROGRAM, TOKEN_2022_PROGRAM].map((tokenProgram) =>
				tokenAccountFor({ owner, mint, tokenProgram }),
			),
		),
	);
	return [...accounts].sort();
}

/**
 * What, if anything, the stored vault policy got wrong.
 *
 * Stricter than the machine's check, on purpose. The programs are compared exactly, because one extra
 * program is the difference between a vault and a trading account. The destinations are compared
 * exactly, because "any" or one stranger is the difference between a vault and a leak.
 */
function vaultDiffersFrom(wanted: WalletPolicy, stored: WalletPolicy): string | undefined {
	if (stored.owner !== wanted.owner) return "the owner is not the one asked for";
	if (stored.recipients.length !== 0) return "it allows recipients nobody asked for";
	if (stored.approvedPrograms.join(",") !== wanted.approvedPrograms.join(",")) {
		return "it may call programs a vault must not";
	}
	if (stored.approvedMints.join(",") !== wanted.approvedMints.join(",")) {
		return "the approved tokens are not the ones asked for";
	}
	if (stored.wrapsSol) return "it may move SOL somewhere other than the owner";
	const destinations = stored.tokenDestinations;
	if (
		destinations === "any" ||
		destinations.join(",") !== [...wanted.tokenDestinations].join(",")
	) {
		return "it may pay tokens somewhere other than the owner";
	}
	if (stored.maxLamportsPerTransfer > wanted.maxLamportsPerTransfer) {
		return "it allows a larger transfer than asked for";
	}
	return undefined;
}

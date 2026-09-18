/**
 * The machine wallet policy, written in Turnkey's policy language.
 *
 * Turnkey refuses every action by anyone but a root user unless a policy allows it, so the signer only
 * ever gets what these policies grant. Machine wallets are never signed for with a root key: a root key
 * bypasses policies entirely, which would make the whole arrangement decorative.
 *
 * Every value that goes into an expression is checked before it is written in. An address containing a
 * quote would otherwise be able to rewrite the policy that is supposed to contain it, which is the one
 * mistake here that could not be undone.
 *
 * This is the second of two independent checks. Maschina's own rules refuse a trade first, and know
 * about budgets, schedules and machines. Turnkey knows none of that, and refuses on what the transaction
 * actually does. Either one saying no is enough.
 */

import { isSolanaAddress, type WalletPolicy } from "./policy.ts";

export type PolicySpec = {
	policyName: string;
	effect: "EFFECT_ALLOW" | "EFFECT_DENY";
	consensus: string;
	condition: string;
	notes: string;
};

export type PolicyInput = {
	/** A short name for this machine's policies, so they can be found and updated. */
	label: string;
	/** The non-root Turnkey user allowed to sign for this wallet. */
	signerUserId: string;
	/** The machine wallet's own Solana address. */
	walletAddress: string;
	policy: WalletPolicy;
};

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LABEL = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ADDRESS = { test: isSolanaAddress };

function checked(value: string, pattern: { test(value: string): boolean }, what: string): string {
	if (!pattern.test(value)) throw new Error(`invalid ${what}: ${JSON.stringify(value)}`);
	return value;
}

const anyOf = (variable: string, values: readonly string[]) =>
	values.map((value) => `${variable} == '${checked(value, ADDRESS, "address")}'`).join(" || ");

/**
 * The policies for one machine wallet.
 *
 * Two of them, and the second matters as much as the first: one allows exactly the signing this machine
 * needs, and one denies exporting the key to anybody, forever.
 */
export function turnkeyPolicies(input: PolicyInput): PolicySpec[] {
	const { policy } = input;
	const label = checked(input.label, LABEL, "label");
	const signer = checked(input.signerUserId, USER_ID, "signer user id");
	const wallet = checked(input.walletAddress, ADDRESS, "wallet address");

	if (policy.approvedPrograms.length === 0) {
		throw new Error("invalid policy: no approved programs, so nothing could ever be signed");
	}
	if (policy.maxLamportsPerTransfer <= 0n) {
		throw new Error("invalid policy: a transfer limit must be more than zero");
	}

	// The owner is always allowed to receive. Everything else had to be approved deliberately.
	const recipients = [policy.owner, ...policy.recipients];

	const transfers = `solana.tx.transfers.all(t, (${anyOf("t.to", recipients)}) && t.amount <= ${policy.maxLamportsPerTransfer})`;

	// A mint is only visible on a checked token transfer. A plain transfer has no mint, so it fails this
	// rule rather than slipping past it, which is the safe way round.
	const tokenTransfers =
		policy.approvedMints.length === 0
			? "solana.tx.spl_transfers.count() == 0"
			: `solana.tx.spl_transfers.all(t, ${anyOf("t.token_mint", policy.approvedMints)})`;

	const consensus = `approvers.any(user, user.id == '${signer}')`;

	return [
		{
			policyName: `machine:${label}:sign`,
			effect: "EFFECT_ALLOW",
			consensus,
			condition: [
				"activity.kind == 'SIGN_TRANSACTION'",
				`wallet_account.address == '${wallet}'`,
				`solana.tx.program_keys.all(p, ${anyOf("p", policy.approvedPrograms)})`,
				transfers,
				tokenTransfers,
			].join(" && "),
			notes:
				"Machine wallet: approved programs and mints only, SOL only to approved recipients, each transfer capped.",
		},
		{
			policyName: `machine:${label}:no-export`,
			effect: "EFFECT_DENY",
			consensus,
			condition: "activity.action == 'EXPORT'",
			notes: "The signer may never export a key. Nothing overrides this.",
		},
	];
}

/** The policy a set of Turnkey policies describes, read back out of their expressions. */
export function policyFromExpressions(specs: readonly PolicySpec[]): WalletPolicy | undefined {
	const signing = specs.find((spec) => spec.policyName.endsWith(":sign"));
	if (!signing) return undefined;

	const recipients = valuesOf(signing.condition, "t.to");
	const [owner, ...rest] = recipients;
	if (!owner) return undefined;

	const cap = /t\.amount <= (\d+)/.exec(signing.condition)?.[1];
	if (!cap) return undefined;

	return {
		owner,
		recipients: rest,
		approvedPrograms: valuesOf(signing.condition, "p"),
		approvedMints: valuesOf(signing.condition, "t.token_mint"),
		maxLamportsPerTransfer: BigInt(cap),
	};
}

/** Every address compared against one variable in a condition, in the order they appear. */
function valuesOf(condition: string, variable: string): string[] {
	const found: string[] = [];
	const pattern = new RegExp(`${variable.replace(".", "\\.")} == '([1-9A-HJ-NP-Za-km-z]+)'`, "g");
	for (const match of condition.matchAll(pattern)) {
		const value = match[1];
		if (value && !found.includes(value)) found.push(value);
	}
	return found;
}

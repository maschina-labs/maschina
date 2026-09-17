/**
 * The machine wallet policy, written in Turnkey's policy language.
 *
 * Turnkey refuses every action by anyone but its root users unless a policy allows it, so the signer
 * only gets what these policies grant. Root users bypass policies entirely, which is why a machine
 * wallet is never signed for with a root key.
 *
 * Every value that goes into an expression is checked first. An address or id containing a quote
 * could otherwise rewrite the policy.
 */

export const SOLANA_PROGRAMS = {
	system: "11111111111111111111111111111111",
	computeBudget: "ComputeBudget111111111111111111111111111111",
	token: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
	associatedToken: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
} as const;

export type MachineWalletRules = {
	/** The non-root Turnkey user allowed to sign for the wallet. */
	signerUserId: string;
	/** The machine wallet's Solana address. */
	walletAddress: string;
	/** Where SOL may be sent: the owner, and the wallet's own token accounts when swaps need them. */
	transferRecipients: readonly string[];
	/** Programs a transaction may call. */
	approvedPrograms: readonly string[];
	/** Token mints a token transfer may move. */
	approvedMints: readonly string[];
	/** The most SOL, in lamports, a single transfer may move. */
	maxLamportsPerTransfer: bigint;
};

export type PolicySpec = {
	policyName: string;
	effect: "EFFECT_ALLOW" | "EFFECT_DENY";
	consensus: string;
	condition: string;
	notes: string;
};

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** True when the value is base58 and decodes to exactly 32 bytes, which every Solana address does. */
export function isSolanaAddress(value: string): boolean {
	if (value.length < 32 || value.length > 44) return false;
	let number = 0n;
	for (const char of value) {
		const digit = BASE58.indexOf(char);
		if (digit < 0) return false;
		number = number * 58n + BigInt(digit);
	}
	const leadingZeros = value.length - value.replace(/^1+/, "").length;
	const bytes = number === 0n ? 0 : Math.ceil(number.toString(16).length / 2);
	return leadingZeros + bytes === 32;
}

const ADDRESS = { test: isSolanaAddress };
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LABEL = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checked(value: string, pattern: { test(value: string): boolean }, what: string): string {
	if (!pattern.test(value)) throw new Error(`invalid ${what}: ${JSON.stringify(value)}`);
	return value;
}

const anyOf = (variable: string, values: readonly string[]) =>
	values.map((value) => `${variable} == '${checked(value, ADDRESS, "address")}'`).join(" || ");

export function machineWalletPolicies(label: string, rules: MachineWalletRules): PolicySpec[] {
	checked(label, LABEL, "label");
	const signer = checked(rules.signerUserId, USER_ID, "signer user id");
	const wallet = checked(rules.walletAddress, ADDRESS, "wallet address");
	if (rules.approvedPrograms.length === 0) throw new Error("invalid rules: no approved programs");
	if (rules.maxLamportsPerTransfer <= 0n)
		throw new Error("invalid rules: transfer size must be positive");

	const transfers =
		rules.transferRecipients.length === 0
			? "solana.tx.transfers.count() == 0"
			: `solana.tx.transfers.all(t, (${anyOf("t.to", rules.transferRecipients)}) && t.amount <= ${rules.maxLamportsPerTransfer})`;

	// The mint is only visible on checked token transfers. A plain transfer has no mint, so it fails
	// this rule, which is the safe outcome.
	const tokenTransfers =
		rules.approvedMints.length === 0
			? "solana.tx.spl_transfers.count() == 0"
			: `solana.tx.spl_transfers.all(t, ${anyOf("t.token_mint", rules.approvedMints)})`;

	const consensus = `approvers.any(user, user.id == '${signer}')`;
	return [
		{
			policyName: `machine:${label}:sign`,
			effect: "EFFECT_ALLOW",
			consensus,
			condition: [
				"activity.kind == 'SIGN_TRANSACTION'",
				`wallet_account.address == '${wallet}'`,
				`solana.tx.program_keys.all(p, ${anyOf("p", rules.approvedPrograms)})`,
				transfers,
				tokenTransfers,
			].join(" && "),
			notes:
				"Machine wallet policy: approved programs and tokens, SOL only to approved recipients, capped size.",
		},
		{
			policyName: `machine:${label}:no-export`,
			effect: "EFFECT_DENY",
			consensus,
			condition: "activity.action == 'EXPORT'",
			notes: "The signer may never export keys.",
		},
	];
}

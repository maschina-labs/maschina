/**
 * What every wallet provider must prove before Maschina depends on it. Both providers run the same list,
 * so they are judged the same way.
 *
 * Each refusal is paired with an allowed check that differs only in the thing the policy forbids. If
 * the allowed one fails too, the refusal proves nothing: the setup is broken, not the policy working.
 */

export type Expectation = "allowed" | "refused";
export type Network = "devnet" | "mainnet";

export type Check =
	| { id: string; describe: string; expect: "allowed"; network: Network }
	| { id: string; describe: string; expect: "refused"; pairedWith: string; network: Network };

export const CHECKS: readonly Check[] = [
	// Transfers only go back to the owner.
	{
		id: "transfer-owner",
		describe: "Transfer SOL to the owner's address",
		expect: "allowed",
		network: "devnet",
	},
	{
		id: "transfer-outside",
		describe: "Transfer SOL to any other address",
		expect: "refused",
		pairedWith: "transfer-owner",
		network: "devnet",
	},
	// Swaps only between approved tokens, through approved programs.
	{
		id: "swap-approved-tokens",
		describe: "Swap between two approved tokens through the approved program",
		expect: "allowed",
		network: "devnet",
	},
	{
		id: "swap-unapproved-token",
		describe: "Swap into a token that isn't approved",
		expect: "refused",
		pairedWith: "swap-approved-tokens",
		network: "devnet",
	},
	{
		id: "unapproved-program",
		describe: "Call a program that isn't approved",
		expect: "refused",
		pairedWith: "swap-approved-tokens",
		network: "devnet",
	},
	// A maximum size per transaction.
	{
		id: "under-size-limit",
		describe: "A transfer to the owner just under the size limit",
		expect: "allowed",
		network: "devnet",
	},
	{
		id: "over-size-limit",
		describe: "The same transfer just over the size limit",
		expect: "refused",
		pairedWith: "under-size-limit",
		network: "devnet",
	},
	// Payment machines pay approved recipients and nobody else.
	{
		id: "pay-approved-recipient",
		describe: "Pay an address on the approved recipient list",
		expect: "allowed",
		network: "devnet",
	},
	{
		id: "pay-unapproved-recipient",
		describe: "Pay an address that isn't on the list",
		expect: "refused",
		pairedWith: "pay-approved-recipient",
		network: "devnet",
	},
	{
		id: "pay-removed-recipient",
		describe: "Pay a recipient after removing it from the list",
		expect: "refused",
		pairedWith: "pay-approved-recipient",
		network: "devnet",
	},
	// Jupiter routes only exist on mainnet, so the real swap uses a few dollars.
	{
		id: "mainnet-swap",
		describe: "A real Jupiter swap between approved tokens, signed under the policy",
		expect: "allowed",
		network: "mainnet",
	},
];

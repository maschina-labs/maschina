/**
 * Proves a machine's vault against the real Turnkey, on demand.
 *
 * Not a test that runs in CI. It makes a real machine wallet, with its vault, through the same
 * `createMachine` the provisioner runs, and asks Turnkey to sign real transactions built by the real
 * Jupiter. Nothing is ever sent and both accounts are empty, so nothing it does can move money:
 *
 *     pnpm --filter @maschina/provisioner check:vault
 *
 * with the Turnkey keys and an owner address in the environment.
 *
 * What it is for is the refusals. A vault that signs a swap is not a vault, and the only proof that
 * it will not is Turnkey saying no to one. It also signs a real swap each way from the trading account,
 * because the policy expression changed and a machine that cannot trade is not protected, just stuck.
 */

import { baseUnitsOf, newId, ok } from "@maschina/core";
import { buildTransfer, jupiterRouter, parseAddress } from "@maschina/solana";
import { signerUserIdFor, TURNKEY_API, turnkeyApi, turnkeyProvider } from "@maschina/wallet";
import { createMachine } from "../src/create-machine.ts";

const need = (name: string): string => {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set.`);
	return value;
};

const SOL = parseAddress("So11111111111111111111111111111111111111112");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const A_STRANGER = parseAddress("H8ug7u3sCUiNVvM3QdhtNbWjrn9U1wzvGjV6Nz6chJ4E");
/** A blockhash real enough to build with. Nothing here is ever sent. */
const BLOCKHASH = "11111111111111111111111111111111";

type Outcome = { name: string; expected: "signed" | "refused"; got: string };
const outcomes: Outcome[] = [];

async function main(): Promise<void> {
	const owner = parseAddress(need("CHECK_OWNER_ADDRESS"));
	const apiBaseUrl = process.env["TURNKEY_API_BASE_URL"] ?? TURNKEY_API;
	const organizationId = need("TURNKEY_ORGANIZATION_ID");
	const config = (publicKey: string, privateKey: string) => ({
		apiBaseUrl,
		organizationId,
		apiPublicKey: need(publicKey),
		apiPrivateKey: need(privateKey),
	});
	const signing = config("TURNKEY_SIGNER_API_PUBLIC_KEY", "TURNKEY_SIGNER_API_PRIVATE_KEY");
	const provider = turnkeyProvider({
		admin: turnkeyApi(config("TURNKEY_API_PUBLIC_KEY", "TURNKEY_API_PRIVATE_KEY")),
		signer: turnkeyApi(signing),
		signerUserId: await signerUserIdFor(signing),
	});

	let wallet: { address: string; vaultAddress: string } | undefined;
	console.log("making a machine wallet and its vault through createMachine");
	const made = await createMachine(
		{
			provider,
			// Nothing is written: the point is the wallet, and createMachine has already read back and
			// checked both policies by the time it gets here.
			write: async (machine) => {
				wallet = machine.wallet;
				return ok({
					machineId: newId<"machine">(),
					ownerId: newId<"owner">(),
					walletAddress: machine.wallet.address,
					definitionId: "0".repeat(64),
				});
			},
		},
		{
			ownerWallet: owner,
			name: `check-vault-${Date.now()}`,
			kind: "range",
			settings: {
				quoteMint: USDC,
				baseMint: SOL,
				buyLevel: "118000000",
				sellLevel: "122000000",
				amountPerBuy: "10000000",
			},
			limits: { budgetGranted: 50_000_000n, approvedMints: [SOL, USDC] },
		},
	);
	if (!made.ok) throw new Error(`createMachine refused: ${made.error.message}`);
	if (!wallet) throw new Error("createMachine did not hand over a wallet");
	const walletId = made.value.providerWalletId;
	const trading = parseAddress(wallet.address);
	const vault = parseAddress(wallet.vaultAddress);
	console.log(`  wallet ${walletId}\n  trading ${trading}\n  vault   ${vault}`);
	console.log("  both policies read back from turnkey and matched what was asked for");

	const attempt = async (
		name: string,
		expected: Outcome["expected"],
		bytes: Uint8Array,
		account: "trading" | "vault",
	) => {
		const signed = await provider.sign(walletId, bytes, account);
		const got = signed.ok
			? "signed"
			: `${signed.error.kind}: ${signed.error.message.slice(0, 160)}`;
		outcomes.push({ name, expected, got });
		const pass = signed.ok
			? expected === "signed"
			: expected === "refused" && signed.error.kind === "refused";
		console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${got}`);
	};

	const transfer = (from: typeof trading, to: typeof trading) =>
		buildTransfer({
			from,
			to,
			lamports: 1_000_000n,
			blockhash: BLOCKHASH,
			lastValidBlockHeight: 1n,
		});

	const router = jupiterRouter();
	const swap = async (
		from: typeof trading,
		input: typeof SOL,
		output: typeof SOL,
		amount: bigint,
	) => {
		const quote = await router.quote({
			inputMint: input,
			outputMint: output,
			amount: baseUnitsOf(amount),
			slippageBps: 50,
		});
		// Both accounts are empty, so Jupiter's own simulation fails. That is expected and irrelevant:
		// the question is what Turnkey will sign, not what would land.
		const built = await router.build({ quote, wallet: from, allowFailedSimulation: true });
		return built.transaction;
	};

	console.log("\nthe vault");
	await attempt("the vault pays its owner", "signed", transfer(vault, owner), "vault");
	await attempt("the vault pays a stranger", "refused", transfer(vault, A_STRANGER), "vault");
	await attempt(
		"the vault swaps USDC for SOL",
		"refused",
		await swap(vault, USDC, SOL, 1_000_000n),
		"vault",
	);
	await attempt(
		"the vault swaps SOL for USDC",
		"refused",
		await swap(vault, SOL, USDC, 10_000_000n),
		"vault",
	);

	console.log("\nthe trading account");
	await attempt(
		"the trading account buys SOL with USDC",
		"signed",
		await swap(trading, USDC, SOL, 1_000_000n),
		"trading",
	);
	await attempt(
		"the trading account sells SOL for USDC",
		"signed",
		await swap(trading, SOL, USDC, 10_000_000n),
		"trading",
	);
	await attempt(
		"the trading account pays a stranger",
		"refused",
		transfer(trading, A_STRANGER),
		"trading",
	);

	const failed = outcomes.filter(
		(outcome) =>
			!(outcome.got === "signed"
				? outcome.expected === "signed"
				: outcome.expected === "refused" && outcome.got.startsWith("refused")),
	);
	console.log(`\n${outcomes.length - failed.length} of ${outcomes.length} as expected`);
	if (failed.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});

/**
 * Proves the Turnkey adapter against the real Turnkey, on demand.
 *
 * This is not a test that runs in CI. It creates a real wallet in the real organisation and asks Turnkey
 * to sign a real transaction, so it runs when somebody means it:
 *
 *     infisical run --projectId <wallet-spike> --env=dev --path=/wallet-spike -- pnpm --filter @maschina/signer check:turnkey
 *
 * Nothing it does can move money. The transaction it signs is never sent, the wallet it creates is
 * empty, and the point of the exercise is the refusal: a payment to an address nobody approved has to
 * come back refused, from Turnkey, not from us.
 */

import { buildTransfer, parseAddress } from "@maschina/solana";
import type { WalletPolicy } from "@maschina/wallet";
import { signerUserIdFor, TURNKEY_API, turnkeyApi, turnkeyProvider } from "@maschina/wallet";

const need = (name: string): string => {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set. Run this through infisical.`);
	return value;
};

/** A blockhash that is real enough to build a transaction with. Nothing here is ever sent. */
const BLOCKHASH = "11111111111111111111111111111111";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const A_STRANGER = parseAddress("H8ug7u3sCUiNVvM3QdhtNbWjrn9U1wzvGjV6Nz6chJ4E");

async function main(): Promise<void> {
	const owner = parseAddress(need("SPIKE_OWNER_ADDRESS"));
	const apiBaseUrl = process.env["TURNKEY_API_BASE_URL"] ?? TURNKEY_API;
	const organizationId = need("TURNKEY_ORGANIZATION_ID");

	/** Creates wallets and writes policies. Never signs for a machine. */
	const adminConfig = {
		apiBaseUrl,
		organizationId,
		apiPublicKey: need("TURNKEY_API_PUBLIC_KEY"),
		apiPrivateKey: need("TURNKEY_API_PRIVATE_KEY"),
	};
	/** Signs for machines, and Turnkey allows it nothing else. */
	const signerConfig = {
		apiBaseUrl,
		organizationId,
		apiPublicKey: need("TURNKEY_SIGNER_API_PUBLIC_KEY"),
		apiPrivateKey: need("TURNKEY_SIGNER_API_PRIVATE_KEY"),
	};

	const signerUserId = await signerUserIdFor(signerConfig);
	console.log(`signing as turnkey user ${signerUserId}`);

	const provider = turnkeyProvider({
		admin: turnkeyApi(adminConfig),
		signer: turnkeyApi(signerConfig),
		signerUserId,
	});

	const policy: WalletPolicy = {
		owner,
		recipients: [],
		approvedPrograms: [SYSTEM_PROGRAM],
		approvedMints: [],
		maxLamportsPerTransfer: 10_000_000n,
	};

	const label = `check-${Date.now()}`;
	console.log(`creating a wallet (${label}) with its policy`);
	const created = await provider.createWallet({ label, policy });
	if (!created.ok) throw new Error(`creating the wallet failed: ${created.error.message}`);
	console.log(`  wallet ${created.value.walletId}`);
	console.log(`  address ${created.value.address}`);

	console.log("reading the policy back from turnkey");
	const readBack = await provider.readPolicy(created.value.walletId);
	if (!readBack.ok) throw new Error(`reading the policy failed: ${readBack.error.message}`);
	const matches = JSON.stringify(readBack.value, replacer) === JSON.stringify(policy, replacer);
	console.log(`  ${matches ? "matches what was asked for" : "DOES NOT MATCH"}`);
	if (!matches) {
		console.log(`  asked: ${JSON.stringify(policy, replacer)}`);
		console.log(`  got:   ${JSON.stringify(readBack.value, replacer)}`);
		throw new Error("the stored policy is not the policy that was asked for");
	}

	const allowed = buildTransfer({
		from: parseAddress(created.value.address),
		to: owner,
		lamports: 1_000_000n,
		blockhash: BLOCKHASH,
		lastValidBlockHeight: 1n,
	});
	console.log("signing a payment to the owner, which the policy allows");
	const signed = await provider.sign(created.value.walletId, allowed);
	console.log(
		signed.ok
			? `  signed, ${signed.value.length} bytes`
			: `  REFUSED: ${signed.error.kind}: ${signed.error.message}`,
	);
	if (!signed.ok) throw new Error("turnkey refused a payment its policy allows");

	const forbidden = buildTransfer({
		from: parseAddress(created.value.address),
		to: A_STRANGER,
		lamports: 1_000_000n,
		blockhash: BLOCKHASH,
		lastValidBlockHeight: 1n,
	});
	console.log("signing a payment to a stranger, which the policy forbids");
	const refused = await provider.sign(created.value.walletId, forbidden);
	if (refused.ok) throw new Error("turnkey signed a payment nobody approved");
	console.log(`  refused as ${refused.error.kind}, retryable ${refused.error.retryable}`);
	if (refused.error.kind !== "refused") {
		throw new Error(`the refusal came back as ${refused.error.kind}, which nothing would act on`);
	}

	const over = buildTransfer({
		from: parseAddress(created.value.address),
		to: owner,
		lamports: 20_000_000n,
		blockhash: BLOCKHASH,
		lastValidBlockHeight: 1n,
	});
	console.log("signing a payment over the size limit, which the policy forbids");
	const tooBig = await provider.sign(created.value.walletId, over);
	console.log(
		tooBig.ok ? "  SIGNED, which it should not have" : `  refused as ${tooBig.error.kind}`,
	);
	if (tooBig.ok) throw new Error("turnkey signed a payment over the policy's limit");

	console.log("\nall four checks passed against the real turnkey");
}

const replacer = (_key: string, value: unknown) =>
	typeof value === "bigint" ? value.toString() : value;

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});

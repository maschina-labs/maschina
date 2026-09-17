import {
	address,
	createSolanaRpc,
	getBase64EncodedWireTransaction,
	getSignatureFromTransaction,
	getTransactionDecoder,
} from "@solana/kit";

export type DevnetRpc = ReturnType<typeof createSolanaRpc>;

/** Circle's devnet USDC. Real, so a transfer of it only fails where a policy says no. */
export const DEVNET_USDC = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export const devnetUrl = (apiKey: string) => `https://devnet.helius-rpc.com/?api-key=${apiKey}`;

export const devnetRpc = (apiKey: string): DevnetRpc => createSolanaRpc(devnetUrl(apiKey));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a signed transaction and waits until the cluster confirms it. Throws if it lands with an
 * error or isn't confirmed in time. Returns its signature.
 */
export async function submitSigned(
	rpc: DevnetRpc,
	signedHex: string,
	{ pollMs = 1_000, timeoutMs = 60_000 }: { pollMs?: number; timeoutMs?: number } = {},
): Promise<string> {
	const transaction = getTransactionDecoder().decode(Buffer.from(signedHex, "hex"));
	const signed = Object.values(transaction.signatures).every((sig) =>
		sig?.some((byte) => byte !== 0),
	);
	if (!signed) throw new Error("transaction is not signed");

	const signature = getSignatureFromTransaction(transaction);
	await rpc
		.sendTransaction(getBase64EncodedWireTransaction(transaction), {
			encoding: "base64",
			preflightCommitment: "confirmed",
		})
		.send();

	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const { value } = await rpc.getSignatureStatuses([signature]).send();
		const status = value[0];
		if (status?.err)
			throw new Error(
				`transaction failed: ${JSON.stringify(status.err, (_, v) => (typeof v === "bigint" ? v.toString() : v))}`,
			);
		if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
			return signature;
		}
		await sleep(pollMs);
	}
	throw new Error(`transaction ${signature} was not confirmed within ${timeoutMs} ms`);
}

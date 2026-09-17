/**
 * pnpm check:helius   read the owner's balance on devnet and mainnet through Helius (#15)
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm check:helius
 *
 * Read only. The key comes from Infisical and is never printed. Results go to results/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { address, createSolanaRpc } from "@solana/kit";
import { heliusKey, setupEnv } from "./env.ts";
import { devnetUrl, mainnetUrl } from "./solana/devnet.ts";

try {
	const key = heliusKey(process.env);
	const owner = address(setupEnv(process.env).ownerAddress);
	const balances: Record<string, { lamports: string; slot: string }> = {};
	for (const [network, url] of [
		["devnet", devnetUrl(key)],
		["mainnet", mainnetUrl(key)],
	] as const) {
		const { context, value } = await createSolanaRpc(url).getBalance(owner).send();
		balances[network] = { lamports: value.toString(), slot: context.slot.toString() };
		process.stdout.write(`${network}: ${Number(value) / 1e9} SOL at slot ${context.slot}\n`);
	}
	mkdirSync("results", { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	writeFileSync(
		`results/helius-${stamp}.json`,
		`${JSON.stringify({ at: new Date().toISOString(), owner, balances }, null, "\t")}\n`,
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

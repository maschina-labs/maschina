/** Which Solana network a service talks to, and the RPC endpoint for it. */

import { MaschinaError } from "@maschina/core";

export const CLUSTERS = ["mainnet", "devnet", "localnet"] as const;
export type Cluster = (typeof CLUSTERS)[number];

const PUBLIC_RPC: Record<Cluster, string> = {
	mainnet: "https://api.mainnet-beta.solana.com",
	devnet: "https://api.devnet.solana.com",
	localnet: "http://127.0.0.1:8899",
};

export function parseCluster(value: string): Cluster {
	if ((CLUSTERS as readonly string[]).includes(value)) return value as Cluster;
	throw new MaschinaError("invalid_input", `unknown Solana cluster "${value}"`, {
		details: { allowed: CLUSTERS },
	});
}

/**
 * The RPC endpoint to use. Mainnet requires a configured provider: the public endpoint is rate
 * limited and too slow for trading, so falling back to it would fail quietly under load.
 */
export function rpcUrlFor(cluster: Cluster, configured: string | undefined): string {
	if (configured) return configured;
	if (cluster === "mainnet") {
		throw new MaschinaError("invalid_input", "SOLANA_RPC_URL is required on mainnet");
	}
	return PUBLIC_RPC[cluster];
}

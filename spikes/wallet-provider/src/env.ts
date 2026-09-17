import { Keypair } from "@solana/web3.js";
import { z } from "zod";
import { isSolanaAddress } from "./policy.ts";

type Source = Record<string, string | undefined>;

/** Lists the variables that are missing or invalid. Never includes their values. */
export class MissingEnvError extends Error {
	readonly variables: string[];

	constructor(variables: string[]) {
		super(
			`Missing or invalid: ${variables.join(", ")}. Add them in Infisical under /wallet-spike.`,
		);
		this.name = "MissingEnvError";
		this.variables = variables;
	}
}

// An empty value counts as unset, so a copied .env.example fails clearly.
const set = z.string().trim().min(1);

function read<T extends z.ZodRawShape>(shape: T, source: Source): z.infer<z.ZodObject<T>> {
	const values = Object.fromEntries(
		Object.keys(shape).map((key) => [key, source[key] || undefined]),
	);
	const parsed = z.object(shape).safeParse(values);
	if (!parsed.success) {
		const variables = [
			...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
		].sort();
		throw new MissingEnvError(variables);
	}
	return parsed.data;
}

export type TurnkeyEnv = {
	apiPublicKey: string;
	apiPrivateKey: string;
	organizationId: string;
	apiBaseUrl: string;
};

export function turnkeyEnv(source: Source): TurnkeyEnv {
	const env = read(
		{
			TURNKEY_API_PUBLIC_KEY: set,
			TURNKEY_API_PRIVATE_KEY: set,
			TURNKEY_ORGANIZATION_ID: z.uuid(),
			TURNKEY_API_BASE_URL: z.url().default("https://api.turnkey.com"),
		},
		source,
	);
	return {
		apiPublicKey: env.TURNKEY_API_PUBLIC_KEY,
		apiPrivateKey: env.TURNKEY_API_PRIVATE_KEY,
		organizationId: env.TURNKEY_ORGANIZATION_ID,
		apiBaseUrl: env.TURNKEY_API_BASE_URL,
	};
}

export type CrossmintEnv = { apiKey: string; apiBaseUrl: string };

export function crossmintEnv(source: Source): CrossmintEnv {
	// Server keys start with sk_. A client key (ck_) must never be used here.
	const env = read(
		{ CROSSMINT_SERVER_API_KEY: z.string().regex(/^sk_(staging|production)_\S+$/) },
		source,
	);
	const apiKey = env.CROSSMINT_SERVER_API_KEY;
	return {
		apiKey,
		apiBaseUrl: apiKey.startsWith("sk_production_")
			? "https://www.crossmint.com"
			: "https://staging.crossmint.com",
	};
}

export type SetupEnv = { ownerAddress: string; signerPublicKey: string | undefined };

/** What the Turnkey setup needs beyond the root credentials. */
export function setupEnv(source: Source): SetupEnv {
	const env = read(
		{
			SPIKE_OWNER_ADDRESS: z.string().refine(isSolanaAddress),
			TURNKEY_SIGNER_API_PUBLIC_KEY: z
				.string()
				.regex(/^0[23][0-9a-f]{64}$/)
				.optional(),
		},
		source,
	);
	return {
		ownerAddress: env.SPIKE_OWNER_ADDRESS,
		signerPublicKey: env.TURNKEY_SIGNER_API_PUBLIC_KEY,
	};
}

export type ChecksEnv = { signerPublicKey: string; signerPrivateKey: string; heliusApiKey: string };

/** What the devnet checks need: the signer's own key pair, never the root one, and the RPC key. */
export function checksEnv(source: Source): ChecksEnv {
	const env = read(
		{
			TURNKEY_SIGNER_API_PUBLIC_KEY: z.string().regex(/^0[23][0-9a-f]{64}$/),
			TURNKEY_SIGNER_API_PRIVATE_KEY: z.string().regex(/^[0-9a-f]{64}$/),
			HELIUS_API_KEY: set,
		},
		source,
	);
	return {
		signerPublicKey: env.TURNKEY_SIGNER_API_PUBLIC_KEY,
		signerPrivateKey: env.TURNKEY_SIGNER_API_PRIVATE_KEY,
		heliusApiKey: env.HELIUS_API_KEY,
	};
}

/** The Crossmint server signer secret saved by an earlier setup, if any. */
export function crossmintSignerSecret(source: Source): string | undefined {
	return read(
		{
			CROSSMINT_SERVER_SIGNER_SECRET: z
				.string()
				.regex(/^xmsk1_[0-9a-f]{64}$/)
				.optional(),
		},
		source,
	).CROSSMINT_SERVER_SIGNER_SECRET;
}

/** The Crossmint machine signer saved by an earlier setup, if any, with its address. */
export function crossmintMachineSigner(
	source: Source,
): { address: string; secretHex: string } | undefined {
	const secretHex = read(
		{
			CROSSMINT_MACHINE_SIGNER_SECRET: z
				.string()
				.regex(/^[0-9a-f]{128}$/)
				.optional(),
		},
		source,
	).CROSSMINT_MACHINE_SIGNER_SECRET;
	if (!secretHex) return undefined;
	const keypair = Keypair.fromSecretKey(Buffer.from(secretHex, "hex"));
	return { address: keypair.publicKey.toBase58(), secretHex };
}

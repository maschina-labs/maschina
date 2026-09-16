import { z } from "zod";

type Source = Record<string, string | undefined>;

/** Lists the variables that are missing or invalid. Never includes their values. */
export class MissingEnvError extends Error {
	readonly variables: string[];

	constructor(variables: string[]) {
		super(`Set these in spikes/wallet-provider/.env: ${variables.join(", ")}`);
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

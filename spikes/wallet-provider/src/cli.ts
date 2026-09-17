/**
 * pnpm check:credentials [turnkey|crossmint]   check each provider's credentials work
 *
 * Credentials come from the environment, normally injected by Infisical:
 *
 *   infisical run --env=dev --path=/wallet-spike -- pnpm check:credentials
 *
 * .env.example lists every variable.
 */

import { crossmintEnv, MissingEnvError, turnkeyEnv } from "./env.ts";
import { crossmint } from "./providers/crossmint.ts";
import type { SpikeProvider } from "./providers/provider.ts";
import { turnkey } from "./providers/turnkey.ts";

const PROVIDERS: Record<SpikeProvider["name"], () => SpikeProvider> = {
	turnkey: () => turnkey(turnkeyEnv(process.env)),
	crossmint: () => crossmint(crossmintEnv(process.env)),
};

async function ping(names: string[]): Promise<boolean> {
	let allOk = true;
	for (const name of names) {
		const make = PROVIDERS[name as SpikeProvider["name"]];
		if (!make) {
			console.error(`${name}: unknown provider. Use ${Object.keys(PROVIDERS).join(" or ")}.`);
			allOk = false;
			continue;
		}
		try {
			const result = await make().ping();
			process.stdout.write(`${name}: ${result.ok ? "ok" : "failed"}, ${result.detail}\n`);
			allOk &&= result.ok;
		} catch (error) {
			if (!(error instanceof MissingEnvError)) throw error;
			console.error(`${name}: ${error.message}`);
			allOk = false;
		}
	}
	return allOk;
}

const [command, ...args] = process.argv.slice(2);
if (command === "ping") {
	const ok = await ping(args.length > 0 ? args : Object.keys(PROVIDERS));
	process.exit(ok ? 0 : 1);
} else {
	console.error("Usage: pnpm check:credentials [turnkey|crossmint]");
	process.exit(1);
}

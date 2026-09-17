import { Turnkey } from "@turnkey/sdk-server";
import type { TurnkeyEnv } from "../env.ts";
import { describeError, type PingResult, type SpikeProvider } from "./provider.ts";

/** The part of Turnkey's API client the spike uses, so tests can stand in for it. */
export type TurnkeyClient = {
	getWhoami(input: { organizationId: string }): Promise<{
		organizationId: string;
		organizationName: string;
		userId: string;
		username: string;
	}>;
};

const realClient = (env: TurnkeyEnv): TurnkeyClient =>
	new Turnkey({
		apiBaseUrl: env.apiBaseUrl,
		apiPublicKey: env.apiPublicKey,
		apiPrivateKey: env.apiPrivateKey,
		defaultOrganizationId: env.organizationId,
	}).apiClient();

export function turnkey(
	env: TurnkeyEnv,
	client: (env: TurnkeyEnv) => TurnkeyClient = realClient,
): SpikeProvider {
	const api = client(env);
	return {
		name: "turnkey",
		async ping(): Promise<PingResult> {
			try {
				const who = await api.getWhoami({ organizationId: env.organizationId });
				if (who.organizationId !== env.organizationId) {
					return { ok: false, detail: "these credentials belong to a different organization" };
				}
				return { ok: true, detail: `organization ${who.organizationName} as ${who.username}` };
			} catch (error) {
				return { ok: false, detail: `request failed: ${describeError(error)}` };
			}
		},
	};
}

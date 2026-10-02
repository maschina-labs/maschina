/**
 * Everything the machines API needs, built once from the configuration.
 *
 * Both ways of starting the gateway use this, so neither can drift from the other.
 */

import { type Clock, MaschinaError, newId, systemClock } from "@maschina/core";
import {
	actOnMachine,
	createDatabase,
	machineForOwner,
	machinesOf,
	readMachineEvents,
	retuneMachine,
} from "@maschina/db";
import { rpcBalanceReader, rpcBlockhashReader, solanaRpc } from "@maschina/solana";
import { machineBalances } from "./balances.ts";
import { fundingTransaction } from "./funding.ts";
import { orchestratorClient } from "./orchestrator-client.ts";
import { provisionerClient } from "./provisioner-client.ts";
import type { AuthPorts } from "./routes/auth.ts";
import type { MachinePorts } from "./routes/machines.ts";
import { walletSessions } from "./session.ts";
import { asDetail, asRecord, asSummary } from "./shapes.ts";

/** A session lasts a week, and a sentence waiting to be signed lasts five minutes. */
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const CHALLENGE_MS = 5 * 60 * 1000;

export type GatewayConfig = {
	NODE_ENV: string;
	DATABASE_URL: string;
	PROVISIONER_URL: string;
	PROVISIONER_GATEWAY_TOKEN: string;
	ORCHESTRATOR_URL?: string | undefined;
	SOLANA_RPC_URL?: string | undefined;
	ORCHESTRATOR_GATEWAY_TOKEN?: string | undefined;
	GATEWAY_DOMAIN: string;
	GATEWAY_APP_URL: string;
	GATEWAY_COOKIE_DOMAIN?: string | undefined;
};

export function machinePorts(config: GatewayConfig, clock: Clock = systemClock) {
	const database = createDatabase({ url: config.DATABASE_URL, applicationName: "gateway" });
	const provisioner = provisionerClient({
		url: config.PROVISIONER_URL,
		token: config.PROVISIONER_GATEWAY_TOKEN,
	});

	const orchestrator =
		config.ORCHESTRATOR_URL !== undefined && config.ORCHESTRATOR_GATEWAY_TOKEN !== undefined
			? orchestratorClient({
					url: config.ORCHESTRATOR_URL,
					token: config.ORCHESTRATOR_GATEWAY_TOKEN,
				})
			: undefined;

	const rpc = config.SOLANA_RPC_URL === undefined ? undefined : solanaRpc(config.SOLANA_RPC_URL);
	const balanceReader = rpc === undefined ? undefined : rpcBalanceReader(rpc);
	const blockhashes = rpc === undefined ? undefined : rpcBlockhashReader(rpc);

	const sessions = walletSessions(database.db, clock, {
		domain: config.GATEWAY_DOMAIN,
		uri: config.GATEWAY_APP_URL,
		challengeValidForMs: CHALLENGE_MS,
		sessionValidForMs: SESSION_MS,
	});

	const ports: MachinePorts = {
		ownerOf: sessions.ownerOf,
		list: async (ownerId) => (await machinesOf(database.db, ownerId)).map(asSummary),
		read: async (ownerId, machineId) => {
			const machine = await machineForOwner(database.db, ownerId, machineId);
			return machine ? asDetail(machine) : undefined;
		},
		record: async (_ownerId, machineId, limit) =>
			asRecord(await readMachineEvents(database.db, machineId), limit),
		act: async (request) => {
			const done = await actOnMachine(database.db, request);
			if (!done.ok) throw done.error;
			return done.value;
		},
		retune: async (request) => {
			const done = await retuneMachine(database.db, request);
			if (!done.ok) throw done.error;
			return done.value;
		},
		funding: async (request) => {
			if (!blockhashes) throw new MaschinaError("unavailable", "funding cannot be built here yet");
			const machine = await machineForOwner(database.db, request.ownerId, request.machineId);
			if (!machine) throw new MaschinaError("not_found", "no such machine");
			return fundingTransaction(blockhashes, {
				ownerWallet: request.ownerWallet,
				machineWallet: machine.walletAddress,
				usdc: request.usdc,
				lamports: request.lamports,
			});
		},
		balances: async (ownerId, machineId) => {
			if (!balanceReader)
				throw new MaschinaError("unavailable", "balances cannot be read here yet");
			const machine = await machineForOwner(database.db, ownerId, machineId);
			if (!machine) throw new MaschinaError("not_found", "no such machine");
			return machineBalances(balanceReader, machine);
		},
		create: async (request) => provisioner.create(request),
		withdrawEverything: async ({ machineId }) => {
			if (!orchestrator) {
				throw new MaschinaError("unavailable", "withdrawals are not switched on here yet");
			}
			return orchestrator.withdrawEverything({ withdrawalId: newId<"withdrawal">(), machineId });
		},
	};

	const auth: AuthPorts = {
		challenge: sessions.challenge,
		verify: sessions.verify,
		ownerOf: sessions.ownerOf,
		signOut: sessions.signOut,
	};

	const cookie = {
		secure: config.NODE_ENV === "production",
		...(config.GATEWAY_COOKIE_DOMAIN === undefined ? {} : { domain: config.GATEWAY_COOKIE_DOMAIN }),
	};

	return { ports, auth, cookie, close: database.close };
}

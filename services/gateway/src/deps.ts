/**
 * Everything the machines API needs, built once from the configuration.
 *
 * Both ways of starting the gateway use this, so neither can drift from the other.
 */

import { hintFor, openSecret, parseSealingKey, sealSecret } from "@maschina/auth/sealed";
import { type Clock, MaschinaError, newId, systemClock } from "@maschina/core";
import {
	actOnMachine,
	clearOwnerSecret,
	createDatabase,
	haltInForce,
	machineForOwner,
	machinesOf,
	readMachineEvents,
	readOwnerSecret,
	retuneMachine,
	setOwnerSecret,
} from "@maschina/db";
import { claude, converse, type Message, MODELS } from "@maschina/manager";
import { jupiterMarket, rpcBalanceReader, rpcBlockhashReader, solanaRpc } from "@maschina/solana";
import { checkAnthropicKey } from "./anthropic-key.ts";
import { machineBalances } from "./balances.ts";
import { fundingTransaction } from "./funding.ts";
import { brainTools, SYSTEM } from "./manager-brain.ts";
import { orchestratorClient } from "./orchestrator-client.ts";
import { provisionerClient } from "./provisioner-client.ts";
import type { AuthPorts } from "./routes/auth.ts";
import type { MachinePorts } from "./routes/machines.ts";
import type { ManagerPorts } from "./routes/manager.ts";
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
	GATEWAY_SECRETS_KEY?: string | undefined;
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

	/** The stop switch, as the status route reports it. */
	const halt = async () => {
		const found = await haltInForce(database.db);
		return found ? { reason: found.reason, since: found.engagedAt } : undefined;
	};

	const market = jupiterMarket();
	const sealing =
		config.GATEWAY_SECRETS_KEY === undefined
			? undefined
			: parseSealingKey(config.GATEWAY_SECRETS_KEY);
	const manager: ManagerPorts = {
		ownerOf: sessions.ownerOf,
		keyStatus: async (ownerId) => {
			const stored = await readOwnerSecret(database.db, ownerId, "anthropic");
			return stored
				? { set: true, hint: stored.hint, setAt: stored.setAt.toISOString() }
				: { set: false };
		},
		setKey: async (ownerId, key) => {
			if (!sealing) throw new MaschinaError("unavailable", "keys cannot be kept here yet");
			await checkAnthropicKey(key);
			await setOwnerSecret(database.db, {
				ownerId,
				kind: "anthropic",
				sealed: sealSecret(sealing, key),
				hint: hintFor(key),
			});
			return { set: true, hint: hintFor(key), setAt: new Date().toISOString() };
		},
		clearKey: async (ownerId) => {
			await clearOwnerSecret(database.db, ownerId, "anthropic");
		},
		ask: async (ownerId, said) => {
			const stored = await readOwnerSecret(database.db, ownerId, "anthropic");
			if (!stored || !sealing)
				throw new MaschinaError("conflict", "add your Anthropic key in settings first");
			const key = openSecret(sealing, stored.sealed);
			const tools = brainTools({
				machines: async () => (await machinesOf(database.db, ownerId)).map(asSummary),
				record: async (machineId) => {
					const machine = await machineForOwner(database.db, ownerId, machineId);
					if (!machine) return undefined;
					return asRecord(await readMachineEvents(database.db, machineId), 25);
				},
				scan: (request) => market(request),
			});
			const messages: Message[] = said.map((each) => ({
				role: each.role === "you" ? "user" : "assistant",
				content: each.text,
			}));
			const turn = await converse({
				claude: claude(key),
				model: MODELS.think,
				system: SYSTEM,
				messages,
				tools,
			});
			return {
				reply: turn.reply,
				costUsd: turn.costUsd,
				looked: turn.calls.map((call) => ({ tool: call.name, ok: call.ok })),
				steps: turn.steps,
			};
		},
	};

	return { ports, auth, cookie, halt, manager, close: database.close };
}

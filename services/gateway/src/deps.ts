/**
 * Everything the machines API needs, built once from the configuration.
 *
 * Both ways of starting the gateway use this, so neither can drift from the other.
 */

import { type Clock, systemClock } from "@maschina/core";
import {
	actOnMachine,
	createDatabase,
	machineForOwner,
	machinesOf,
	readMachineEvents,
} from "@maschina/db";
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
		create: async (request) => provisioner.create(request),
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

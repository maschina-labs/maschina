/**
 * Everything the machines API needs, built once from the configuration.
 *
 * Both ways of starting the gateway use this, so neither can drift from the other.
 */

import {
	actOnMachine,
	createDatabase,
	machineForOwner,
	machinesOf,
	readMachineEvents,
} from "@maschina/db";
import { sql } from "drizzle-orm";
import { provisionerClient } from "./provisioner-client.ts";
import type { MachinePorts } from "./routes/machines.ts";
import { developmentSession } from "./session.ts";
import { asDetail, asRecord, asSummary } from "./shapes.ts";

export type GatewayConfig = {
	NODE_ENV: string;
	DATABASE_URL: string;
	PROVISIONER_URL: string;
	PROVISIONER_GATEWAY_TOKEN: string;
	GATEWAY_DEV_OWNER_WALLET?: string | undefined;
};

export function machinePorts(config: GatewayConfig) {
	const database = createDatabase({ url: config.DATABASE_URL, applicationName: "gateway" });
	const provisioner = provisionerClient({
		url: config.PROVISIONER_URL,
		token: config.PROVISIONER_GATEWAY_TOKEN,
	});

	const sessions = developmentSession({
		production: config.NODE_ENV === "production",
		ownerWallet: config.GATEWAY_DEV_OWNER_WALLET,
		// The owner must already exist: the gateway does not create owners, sign-in does.
		ownerFor: async (walletAddress) => {
			const rows = await database.db.execute<{ id: string }>(
				sql`select id from owners where wallet_address = ${walletAddress}`,
			);
			const row = rows[0];
			return row ? { ownerId: row.id, walletAddress } : undefined;
		},
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

	return { ports, close: database.close };
}

/**
 * Alerts for the bots: what an owner has not yet been told, and word back once they have.
 *
 * The bots never read the database, so they ask here. These routes answer the bots' token alone: a node
 * or the gateway has no business deciding what an owner hears. What counts as an alert, and who has been
 * told, is the record's job; this only passes it on.
 */

import {
	ALERT_CHANNELS,
	type Alert,
	type AlertChannel,
	AlertDelivered,
	PendingAlerts,
} from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { Hono } from "hono";

export type AlertStore = {
	pending(ask: { channel: AlertChannel; ownerIds: string[]; since: Date }): Promise<Alert[]>;
	delivered(delivered: AlertDelivered): Promise<void>;
};

/** The record's alert, spelled for the wire: amounts as digits, moments as ISO strings. */
export function alertOnWire(alert: {
	eventId: string;
	ownerId: string;
	machineId: string;
	machineName: string;
	type: string;
	occurredAt: Date;
	trade?: { inputMint: string; outputMint: string; inputAmount: bigint; outputAmount: bigint };
	realised?: bigint;
	reason?: string;
}): Alert {
	return {
		eventId: alert.eventId,
		ownerId: alert.ownerId,
		machineId: alert.machineId,
		machineName: alert.machineName,
		type: alert.type,
		occurredAt: alert.occurredAt.toISOString(),
		...(alert.trade === undefined
			? {}
			: {
					trade: {
						inputMint: alert.trade.inputMint,
						outputMint: alert.trade.outputMint,
						inputAmount: alert.trade.inputAmount.toString(),
						outputAmount: alert.trade.outputAmount.toString(),
					},
				}),
		...(alert.realised === undefined ? {} : { realised: alert.realised.toString() }),
		...(alert.reason === undefined ? {} : { reason: alert.reason }),
	};
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function alertRoutes(store: AlertStore) {
	return new Hono<ServiceEnv>()
		.get("/pending", async (c) => {
			const channel = c.req.query("channel");
			if (!ALERT_CHANNELS.includes(channel as AlertChannel)) {
				throw new MaschinaError("invalid_input", "channel is where the alerts are going");
			}
			const ownerIds = c.req.queries("owner") ?? [];
			if (ownerIds.some((owner) => !UUID.test(owner))) {
				throw new MaschinaError("invalid_input", "each owner is an owner id");
			}
			const since = new Date(c.req.query("since") ?? "");
			if (Number.isNaN(since.getTime())) {
				throw new MaschinaError("invalid_input", "since is the moment to tell things from");
			}
			const alerts = await store.pending({ channel: channel as AlertChannel, ownerIds, since });
			return c.json(PendingAlerts.parse({ alerts }), 200);
		})
		.post("/delivered", async (c) => {
			const body = await c.req.json().catch(() => undefined);
			const parsed = AlertDelivered.safeParse(body);
			if (!parsed.success) {
				throw new MaschinaError("invalid_input", "say which event went out, and on which channel");
			}
			await store.delivered(parsed.data);
			return c.json({ ok: true }, 200);
		});
}

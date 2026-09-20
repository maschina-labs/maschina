/**
 * The machines an owner has, and what they may do with them.
 *
 * Every route here takes the owner from the session and asks the record for "this owner's machine with
 * this id". An id in a request is never authority: somebody else's machine is not found, rather than
 * refused with a hint about what exists.
 *
 * The API changes what a machine may do and reads what it did. It never trades. Creating a machine is
 * passed to the provisioner, which holds the only key that can make a wallet.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
	CreateMachineRequest,
	CreateMachineResponse,
	ErrorBody,
	MachineActionRequest,
	MachineActionResponse,
	MachineDetail,
	MachineList,
	MachineRecord,
} from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";

/** Who is asking. The session decides; nothing else may. */
export type Owner = { ownerId: string; walletAddress: string };

export type MachinePorts = {
	/** The owner of this request, or nothing when nobody is signed in. */
	ownerOf(headers: Headers): Promise<Owner | undefined>;
	list(ownerId: string): Promise<unknown[]>;
	read(ownerId: string, machineId: string): Promise<unknown | undefined>;
	record(ownerId: string, machineId: string, limit: number): Promise<unknown[]>;
	act(request: {
		ownerId: string;
		machineId: string;
		action: "fund" | "start" | "pause" | "resume" | "stop";
		budgetGranted?: bigint;
	}): Promise<{ state: string }>;
	create(request: CreateMachineRequest & { ownerWallet: string }): Promise<CreateMachineResponse>;
};

const machineId = z.string().openapi({ description: "The machine's id" });
const problem = {
	400: {
		description: "The request is not valid",
		content: { "application/json": { schema: ErrorBody } },
	},
	401: {
		description: "Nobody is signed in",
		content: { "application/json": { schema: ErrorBody } },
	},
	404: { description: "No such machine", content: { "application/json": { schema: ErrorBody } } },
};

const list = createRoute({
	method: "get",
	path: "/machines",
	tags: ["Machines"],
	summary: "The machines you own",
	responses: {
		200: { description: "Your machines", content: { "application/json": { schema: MachineList } } },
		...problem,
	},
});

const read = createRoute({
	method: "get",
	path: "/machines/{machineId}",
	tags: ["Machines"],
	summary: "One machine",
	request: { params: z.object({ machineId }) },
	responses: {
		200: { description: "The machine", content: { "application/json": { schema: MachineDetail } } },
		...problem,
	},
});

const record = createRoute({
	method: "get",
	path: "/machines/{machineId}/record",
	tags: ["Machines"],
	summary: "What the machine did, newest first",
	request: {
		params: z.object({ machineId }),
		query: z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }),
	},
	responses: {
		200: { description: "The record", content: { "application/json": { schema: MachineRecord } } },
		...problem,
	},
});

const act = createRoute({
	method: "post",
	path: "/machines/{machineId}/actions",
	tags: ["Machines"],
	summary: "Fund, start, pause, resume or stop a machine",
	request: {
		params: z.object({ machineId }),
		body: { content: { "application/json": { schema: MachineActionRequest } } },
	},
	responses: {
		200: {
			description: "What the machine is now",
			content: { "application/json": { schema: MachineActionResponse } },
		},
		409: {
			description: "The machine cannot do that from where it is",
			content: { "application/json": { schema: ErrorBody } },
		},
		...problem,
	},
});

const create = createRoute({
	method: "post",
	path: "/machines",
	tags: ["Machines"],
	summary: "Create a machine, with its own wallet",
	request: {
		body: {
			content: {
				"application/json": { schema: CreateMachineRequest.omit({ ownerWallet: true }) },
			},
		},
	},
	responses: {
		201: {
			description: "The machine, and the wallet to fund",
			content: { "application/json": { schema: CreateMachineResponse } },
		},
		...problem,
	},
});

export function machineRoutes(ports: MachinePorts) {
	const app = new OpenAPIHono<ServiceEnv>();

	/** Every route here needs an owner. Nothing below runs without one. */
	const owner = async (c: { req: { raw: Request } }): Promise<Owner> => {
		const found = await ports.ownerOf(c.req.raw.headers);
		if (!found) throw new MaschinaError("unauthenticated", "sign in first");
		return found;
	};

	const mustExist = <T>(machine: T | undefined): T => {
		if (machine === undefined) throw new MaschinaError("not_found", "no such machine");
		return machine;
	};

	return app
		.openapi(list, async (c) => {
			const who = await owner(c);
			return c.json(MachineList.parse({ machines: await ports.list(who.ownerId) }), 200);
		})
		.openapi(read, async (c) => {
			const who = await owner(c);
			const machine = mustExist(await ports.read(who.ownerId, c.req.valid("param").machineId));
			return c.json(MachineDetail.parse(machine), 200);
		})
		.openapi(record, async (c) => {
			const who = await owner(c);
			const { machineId: id } = c.req.valid("param");
			// Asking for the record of a machine that is not yours is the same as asking for one that does
			// not exist, so the machine is read first.
			mustExist(await ports.read(who.ownerId, id));
			const limit = c.req.valid("query").limit ?? 50;
			return c.json(
				MachineRecord.parse({ events: await ports.record(who.ownerId, id, limit) }),
				200,
			);
		})
		.openapi(act, async (c) => {
			const who = await owner(c);
			const { machineId: id } = c.req.valid("param");
			const body = c.req.valid("json");
			const done = await ports.act({
				ownerId: who.ownerId,
				machineId: id,
				action: body.action,
				...(body.budgetGranted === undefined ? {} : { budgetGranted: BigInt(body.budgetGranted) }),
			});
			return c.json(MachineActionResponse.parse(done), 200);
		})
		.openapi(create, async (c) => {
			const who = await owner(c);
			const asked = c.req.valid("json");
			// The owner's wallet comes from the session, never from the request: a machine's funds can
			// only ever reach the person who created it.
			const made = await ports.create({ ...asked, ownerWallet: who.walletAddress });
			return c.json(CreateMachineResponse.parse(made), 201);
		});
}

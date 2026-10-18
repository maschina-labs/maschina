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
	FundingRequest,
	FundingTransaction,
	MachineActionRequest,
	MachineActionResponse,
	MachineBalances,
	MachineDetail,
	MachineList,
	MachineRecord,
	RetuneMachineRequest,
	RetuneMachineResponse,
	WithdrawEverythingResponse,
} from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { mayRunOnRealMoney } from "../live-machines.ts";

/** Who is asking. The session decides; nothing else may. */
/** A person who signed in without a wallet has none yet, and cannot do what moves money until they link one. */
export type Owner = { ownerId: string; walletAddress: string | null; email?: string | null };

/** The wallet a machine pays, which a person without one has to link first. */
function walletOf(who: Owner): string {
	if (!who.walletAddress) {
		throw new MaschinaError(
			"forbidden",
			"link a wallet first: a machine can only ever pay its owner's wallet",
		);
	}
	return who.walletAddress;
}

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
	/** A new recipe for a paused machine. The record decides whether it is theirs and paused. */
	retune(request: {
		ownerId: string;
		machineId: string;
		kind: string;
		settings: Record<string, unknown>;
	}): Promise<RetuneMachineResponse>;
	/**
	 * An unsigned transaction moving the owner's own dollars and SOL into the machine, for their wallet to
	 * approve. The paying wallet is always the one signed in.
	 */
	funding(request: {
		ownerId: string;
		ownerWallet: string;
		machineId: string;
		usdc: bigint;
		lamports: bigint;
	}): Promise<FundingTransaction>;
	/** What the machine holds on chain right now. The machine is known to be theirs by now. */
	balances(ownerId: string, machineId: string): Promise<MachineBalances>;
	create(request: CreateMachineRequest): Promise<CreateMachineResponse>;
	/** Everything the machine holds, back to its owner. The machine is known to be theirs by now. */
	withdrawEverything(request: {
		ownerId: string;
		machineId: string;
	}): Promise<WithdrawEverythingResponse>;
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

const balances = createRoute({
	method: "get",
	path: "/machines/{machineId}/balances",
	tags: ["Machines"],
	summary: "What the machine holds on chain",
	description:
		"Read from the chain at the moment of asking: the trading wallet, and the vault profit is banked into. Amounts are whole numbers of each token's smallest unit.",
	request: { params: z.object({ machineId }) },
	responses: {
		200: {
			description: "Its balances",
			content: { "application/json": { schema: MachineBalances } },
		},
		503: {
			description: "The chain cannot be read from here",
			content: { "application/json": { schema: ErrorBody } },
		},
		...problem,
	},
});

const funding = createRoute({
	method: "post",
	path: "/machines/{machineId}/funding",
	tags: ["Machines"],
	summary: "A transaction that funds a machine from your wallet",
	description:
		"Built for the wallet that signed in and nothing else: your USDC and a little SOL for its fees, into the machine's own wallet. Nothing moves until your wallet approves it.",
	request: {
		params: z.object({ machineId }),
		body: { content: { "application/json": { schema: FundingRequest } } },
	},
	responses: {
		200: {
			description: "The unsigned transaction",
			content: { "application/json": { schema: FundingTransaction } },
		},
		503: {
			description: "The chain cannot be reached from here",
			content: { "application/json": { schema: ErrorBody } },
		},
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

const retune = createRoute({
	method: "post",
	path: "/machines/{machineId}/recipe",
	tags: ["Machines"],
	summary: "Change a paused machine's recipe",
	description:
		"The machine keeps its wallet, its money and its record, and runs the new recipe from when it is resumed. It has to be paused first, and it keeps spending the token its budget is counted in.",
	request: {
		params: z.object({ machineId }),
		body: { content: { "application/json": { schema: RetuneMachineRequest } } },
	},
	responses: {
		200: {
			description: "The recipe it now runs",
			content: { "application/json": { schema: RetuneMachineResponse } },
		},
		409: {
			description: "The machine is not paused",
			content: { "application/json": { schema: ErrorBody } },
		},
		...problem,
	},
});

const withdraw = createRoute({
	method: "post",
	path: "/machines/{machineId}/withdraw",
	tags: ["Machines"],
	summary: "Take everything out of a machine",
	description:
		"Every token and all the SOL, from the machine's trading account and its vault, back to the wallet that signed in. The machine has to be paused or stopped first. Nothing about where the money goes can be asked for: it goes to the owner.",
	request: {
		params: z.object({ machineId }),
		body: {
			required: false,
			content: { "application/json": { schema: z.strictObject({}) } },
		},
	},
	responses: {
		200: {
			description: "What went home, and anything that could not",
			content: { "application/json": { schema: WithdrawEverythingResponse } },
		},
		409: {
			description: "The machine is still running",
			content: { "application/json": { schema: ErrorBody } },
		},
		503: {
			description: "Withdrawals are not switched on here",
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
				"application/json": {
					schema: CreateMachineRequest.omit({ ownerId: true, ownerWallet: true }),
				},
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

/**
 * How many machines one owner may have, by kind.
 *
 * Nothing limited this before, and every machine is scheduled by the orchestrator and run by the
 * daemon on one box, so one enthusiastic person or one script was enough to swamp it. The numbers
 * differ because the costs do: a paper machine signs nothing and holds no wallet at the provider,
 * while a real one holds a wallet, policies and money, and is held to the beta caps besides.
 *
 * A ceiling, not a target. Raised through configuration rather than a deploy.
 */
export type MachineCaps = { paper: number; live: number };

export const DEFAULT_MACHINE_CAPS: MachineCaps = { paper: 10, live: 3 };

export function machineRoutes(
	ports: MachinePorts,
	liveWallets: string[] = [],
	caps: MachineCaps = DEFAULT_MACHINE_CAPS,
) {
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
		.openapi(funding, async (c) => {
			const who = await owner(c);
			const { machineId: id } = c.req.valid("param");
			mustExist(await ports.read(who.ownerId, id));
			const body = c.req.valid("json");
			const built = await ports.funding({
				ownerId: who.ownerId,
				// The session's wallet pays. A request cannot name somebody else's.
				ownerWallet: walletOf(who),
				machineId: id,
				usdc: BigInt(body.usdc),
				lamports: BigInt(body.lamports),
			});
			return c.json(FundingTransaction.parse(built), 200);
		})
		.openapi(balances, async (c) => {
			const who = await owner(c);
			const { machineId: id } = c.req.valid("param");
			// Somebody else's machine is not found, the same as one that does not exist.
			mustExist(await ports.read(who.ownerId, id));
			return c.json(MachineBalances.parse(await ports.balances(who.ownerId, id)), 200);
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
		.openapi(retune, async (c) => {
			const who = await owner(c);
			const { machineId: id } = c.req.valid("param");
			const body = c.req.valid("json");
			const done = await ports.retune({
				ownerId: who.ownerId,
				machineId: id,
				kind: body.kind,
				settings: body.settings,
			});
			return c.json(RetuneMachineResponse.parse(done), 200);
		})
		.openapi(withdraw, async (c) => {
			const who = await owner(c);
			const { machineId: id } = c.req.valid("param");
			// Somebody else's machine is not found, the same as one that does not exist.
			mustExist(await ports.read(who.ownerId, id));
			const done = await ports.withdrawEverything({ ownerId: who.ownerId, machineId: id });
			return c.json(WithdrawEverythingResponse.parse(done), 200);
		})
		.openapi(create, async (c) => {
			const who = await owner(c);
			const asked = c.req.valid("json");
			// The owner's wallet comes from the session, never from the request: a machine's funds can
			// only ever reach the person who created it.
			// A paper machine never signs and never pays anyone, so it needs no wallet at all: somebody
			// who signed in with an email and has never linked one can still try Maschina. Real money
			// needs the owner's wallet, because that is the only address its funds can ever reach.
			const ownerWallet = asked.paper ? who.walletAddress : walletOf(who);
			// Paper is open to everyone. Real money is not, until the signer judges a transaction's own
			// bytes and there has been an audit. Checked here, before anything is written or a wallet
			// is made, so a refused machine leaves nothing behind.
			if (
				!mayRunOnRealMoney({
					paper: asked.paper,
					ownerWallet: ownerWallet ?? "",
					allowed: liveWallets,
				})
			)
				throw new MaschinaError(
					"forbidden",
					"Maschina is open on paper only. A paper machine trades against live prices with no money at risk; real money is not open yet.",
				);
			// Counted from the record, not from anything the caller says, and counted before a wallet
			// is made, so a refused machine costs nothing and leaves nothing behind.
			const cap = asked.paper ? caps.paper : caps.live;
			const already = (await ports.list(who.ownerId)).length;
			if (already >= cap) {
				throw new MaschinaError(
					"forbidden",
					`${cap} machines is the most one account may have while Maschina is in beta. Stop one you are no longer using, or write to support@maschina.dev.`,
				);
			}

			const made = await ports.create({
				...asked,
				ownerId: who.ownerId,
				...(ownerWallet ? { ownerWallet } : {}),
			});
			return c.json(CreateMachineResponse.parse(made), 201);
		});
}

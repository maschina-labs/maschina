/**
 * What a worker can ask the control plane for.
 *
 * This interface is the node boundary, expressed in types. A worker gets its
 * authority checked and its events recorded by calling these two methods, and it
 * has no other way to affect anything durable. It cannot reach Postgres, and CI
 * checks that it cannot (`.github/ci/check-node-boundary.mjs`).
 *
 * Defining it as a port rather than importing the database has three payoffs:
 *
 *   The boundary is real. `06-NODES` open question 1 warns about building a
 *   system that only works colocated and discovering at Stage 2 that the
 *   separation was never there. It cannot happen if the worker has no other
 *   option.
 *
 *   A worker that cannot reach the control plane makes no progress, rather than
 *   proceeding unsupervised. That is `06-NODES` open question 4, where the
 *   honest default is no, and here it falls out of the shape rather than being
 *   enforced.
 *
 *   The effect path is unit testable without a database or a server.
 */

import type {
	Authorization,
	AuthorizationRequest,
	Event,
	ModelClass,
	NewEvent,
} from "@maschina/core";

/** What a worker asks for when it wants the model to decide something. */
export interface ModelRequest {
	readonly capabilityId: string;
	readonly holder: string;
	/** A class, never a vendor's product name. `04-WORKERS` §7. */
	readonly modelClass: ModelClass;
	readonly prompt: string;
}

/** What came back, including what it cost, because a model call is metered. */
export interface ModelResult {
	readonly text: string;
	/** What actually answered, which is not necessarily what was asked for. */
	readonly model: string;
	/** List value in micro-dollars. `ADR-009` §3. */
	readonly cost: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly durationMs: number;
}

/** What a worker asks for when it wants something to exist on a remote. */
export interface CommitRequest {
	readonly capabilityId: string;
	readonly holder: string;
	/** `owner/name`. Checked against the capability's scope on the other side. */
	readonly repository: string;
	readonly branch: string;
	readonly path: string;
	readonly content: string;
	/** The Intent this belongs to, written into the commit so it can be found later. */
	readonly intentId: string;
}

export interface CommitResult {
	readonly commit: string;
	readonly branch: string;
	readonly repository: string;
	readonly pushed: boolean;
}

/** What the remote says about an effect nobody knows the fate of. */
export interface Reconciliation {
	readonly landed: boolean;
	readonly commit: string | null;
}

export interface ControlPlane {
	/** Append to the log. Throws if the control plane cannot be reached. */
	append(event: NewEvent): Promise<Event>;
	/** Check authority, at use. Never cached, on either side. */
	authorize(request: AuthorizationRequest): Promise<Authorization>;
	/**
	 * Ask the model something.
	 *
	 * The worker does not know how a model call is made and has no way to make
	 * one itself. The credential lives on the other side of this method and the
	 * process that would run is spawned there, which is what `05-CAPABILITIES`
	 * §5 and `ADR-003` §3 require independently of each other.
	 */
	invokeModel(request: ModelRequest): Promise<ModelResult>;
	/**
	 * Ask the broker to put something on a remote.
	 *
	 * The worker never learns how. The credential is on the other side of this
	 * method and the node process does not have it, which is `05-CAPABILITIES` §5
	 * enforced by absence rather than by restraint.
	 */
	commit(request: CommitRequest): Promise<CommitResult>;
	/**
	 * Ask the world whether an effect landed, after a crash left it unknown.
	 *
	 * Throws rather than guessing when the remote cannot be reached. "I could not
	 * ask" is not the same answer as "it did not happen", and P8 forbids
	 * resolving that in whichever direction is convenient.
	 */
	reconcile(repository: string, branch: string, intentId: string): Promise<Reconciliation>;
}

/**
 * This worker lost its lease and is a ghost. `03-RUNTIME` §4.
 *
 * Raised when the log refuses a write for carrying an epoch below the highest
 * seen. There is nothing to retry: a newer lease exists, the write will never
 * succeed, and the work belongs to another node now. The only correct response
 * is to stop, which is why this is a distinct type and not one more failed
 * write. Treated as ordinary failure it would land in the retry path, and
 * retrying is precisely what fencing exists to prevent.
 */
export class WorkerFenced extends Error {
	constructor(
		readonly actor: string,
		readonly epoch: bigint,
		detail: string,
	) {
		super(
			`${actor} is fenced at epoch ${epoch}: a newer lease exists, so this process ` +
				`no longer owns the work and is stopping. ${detail}`,
		);
		this.name = "WorkerFenced";
	}
}

/** Raised when the control plane is unreachable, so it reads that way in a log. */
export class ControlPlaneUnreachable extends Error {
	constructor(operation: string, cause: unknown) {
		super(
			`the control plane could not be reached for ${operation}, so the worker cannot proceed: ` +
				(cause instanceof Error ? cause.message : String(cause)),
		);
		this.name = "ControlPlaneUnreachable";
	}
}

interface WireEvent {
	id: string;
	recordedAt: string;
	actor: string;
	objective: string | null;
	type: string;
	payload: Record<string, unknown>;
	epoch: string;
	causation: string | null;
}

function fromWire(wire: WireEvent): Event {
	return {
		id: BigInt(wire.id),
		recordedAt: new Date(wire.recordedAt),
		actor: wire.actor,
		objective: wire.objective,
		type: wire.type,
		payload: wire.payload,
		epoch: BigInt(wire.epoch),
		causation: wire.causation === null ? null : BigInt(wire.causation),
	};
}

/**
 * The real one. Talks HTTP to the control plane.
 *
 * The lease epoch is bound in here rather than passed at every call, so no call
 * site can forget to carry it. A port is a lease generation: when a worker takes
 * a new lease it builds a new port, and everything written through the old one
 * is fenced by the log without anybody remembering to check.
 */
export function httpControlPlane(baseUrl: string, epoch: bigint = 0n): ControlPlane {
	const post = async (path: string, body: unknown, operation: string): Promise<unknown> => {
		let response: Response;
		try {
			response = await fetch(`${baseUrl}${path}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				// Event ids are bigints and JSON has none. They travel as strings.
				body: JSON.stringify(body, (_key, value: unknown) =>
					typeof value === "bigint" ? value.toString() : value,
				),
			});
		} catch (cause) {
			throw new ControlPlaneUnreachable(operation, cause);
		}

		if (!response.ok) {
			throw new Error(`control plane refused ${operation}: ${response.status}`);
		}
		return response.json();
	};

	return {
		async append(event) {
			// Stamped here, not at the call site. An event written without the
			// lease epoch would slip past the fence, which is the one thing that
			// must not be possible to do by forgetting.
			const stamped = { ...event, epoch: event.epoch ?? epoch };
			return fromWire((await post("/events", stamped, "append")) as WireEvent);
		},
		async authorize(request) {
			return (await post("/capabilities/authorize", request, "authorize")) as Authorization;
		},
		async invokeModel(request) {
			return (await post("/model/invoke", request, "a model call")) as ModelResult;
		},
		async commit(request) {
			return (await post("/repository/effect", request, "a commit")) as CommitResult;
		},
		async reconcile(repository, branch, intentId) {
			const query = new URLSearchParams({ repository, branch, intentId });
			let response: Response;
			try {
				response = await fetch(`${baseUrl}/repository/reconcile?${query}`);
			} catch (cause) {
				throw new ControlPlaneUnreachable("reconciliation", cause);
			}
			if (!response.ok) {
				throw new Error(
					`the remote could not be asked whether ${intentId} landed, so it stays unknown`,
				);
			}
			return (await response.json()) as Reconciliation;
		},
	};
}

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

import type { Authorization, AuthorizationRequest, Event, NewEvent } from "@maschina/core";

export interface ControlPlane {
	/** Append to the log. Throws if the control plane cannot be reached. */
	append(event: NewEvent): Promise<Event>;
	/** Check authority, at use. Never cached, on either side. */
	authorize(request: AuthorizationRequest): Promise<Authorization>;
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

/** The real one. Talks HTTP to the control plane. */
export function httpControlPlane(baseUrl: string): ControlPlane {
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
			return fromWire((await post("/events", event, "append")) as WireEvent);
		},
		async authorize(request) {
			return (await post("/capabilities/authorize", request, "authorize")) as Authorization;
		},
	};
}

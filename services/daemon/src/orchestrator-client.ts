/**
 * The daemon's side of the orchestrator's contract.
 *
 * Everything a daemon learns about work comes through here, and every answer is checked against the
 * contract before the daemon acts on it. A daemon trusts the orchestrator, but not the network between.
 */

import {
	ClaimResponse,
	RenewResponse,
	ReportResponse,
	RunContextResponse,
	type RunReportEvent,
	type SignRequest,
	SignResponse,
} from "@maschina/contracts";

export type ClaimedRun = {
	id: string;
	machineId: string;
	occurrenceKey: string;
	dueAt: Date;
	leaseEpoch: bigint;
	leaseExpiresAt: Date;
};

/** What a node is told about a run it holds, with amounts as numbers again. */
export type RunContext = {
	/** True when this machine only pretends to trade. */
	paper: boolean;
	runId: string;
	machineId: string;
	wallet: string;
	kind: string;
	settings: unknown;
	dueAt: Date;
	state: string;
	canAct: boolean;
	availableBudget: bigint;
	totals: { spent: bigint; buys: number };
};

type ReportResult = { recorded: true } | { recorded: false; reason: "lease_lost" };

export type Orchestrator = {
	claim(nodeId: string): Promise<ClaimedRun | undefined>;
	report(report: {
		nodeId: string;
		runId: string;
		leaseEpoch: bigint;
		event: RunReportEvent;
	}): Promise<ReportResult>;
	/** Keeps the node's hold on a run. `held: false` means the run has moved on. */
	renew(lease: { nodeId: string; runId: string; leaseEpoch: bigint }): Promise<{ held: boolean }>;
	/** What the node needs to run the machine, or nothing once it no longer holds the run. */
	context(lease: {
		nodeId: string;
		runId: string;
		leaseEpoch: bigint;
	}): Promise<RunContext | undefined>;
	/** Proposes a trade. The signer's answer comes back unchanged. */
	propose(proposal: {
		nodeId: string;
		leaseEpoch: bigint;
		proposal: SignRequest;
	}): Promise<SignResponse | "lease_lost">;
};

export function orchestratorClient(options: {
	url: string;
	token: string;
	fetch?: typeof fetch;
}): Orchestrator {
	const fetchFn = options.fetch ?? fetch;

	const post = (path: string, body: unknown, timeoutMs = 10_000) =>
		fetchFn(new URL(path, options.url), {
			method: "POST",
			headers: {
				authorization: `Bearer ${options.token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs),
		});

	return {
		async claim(nodeId) {
			const response = await post("/internal/v1/runs/claim", { nodeId });
			if (!response.ok) throw new Error(`claiming a run failed with ${response.status}`);
			const { run } = ClaimResponse.parse(await response.json());
			if (!run) return undefined;
			return {
				id: run.id,
				machineId: run.machineId,
				occurrenceKey: run.occurrenceKey,
				dueAt: new Date(run.dueAt),
				leaseEpoch: BigInt(run.leaseEpoch),
				leaseExpiresAt: new Date(run.leaseExpiresAt),
			};
		},

		async report(report) {
			const response = await post("/internal/v1/runs/report", {
				...report,
				leaseEpoch: report.leaseEpoch.toString(),
			});
			// The run moved to another node, or the lease lapsed. Not an outage: the loop moves on.
			if (response.status === 409) return { recorded: false, reason: "lease_lost" };
			if (!response.ok) throw new Error(`reporting on a run failed with ${response.status}`);
			ReportResponse.parse(await response.json());
			return { recorded: true };
		},

		async renew(lease) {
			const response = await post("/internal/v1/runs/renew", {
				...lease,
				leaseEpoch: lease.leaseEpoch.toString(),
			});
			if (response.status === 409) return { held: false };
			if (!response.ok) throw new Error(`renewing a lease failed with ${response.status}`);
			RenewResponse.parse(await response.json());
			return { held: true };
		},

		async context(lease) {
			const response = await post("/internal/v1/runs/context", {
				...lease,
				leaseEpoch: lease.leaseEpoch.toString(),
			});
			if (response.status === 409) return undefined;
			if (!response.ok) throw new Error(`asking about a run failed with ${response.status}`);
			const read = RunContextResponse.parse(await response.json());
			return {
				...read,
				dueAt: new Date(read.dueAt),
				availableBudget: BigInt(read.availableBudget),
				totals: { spent: BigInt(read.totals.spent), buys: read.totals.buys },
			};
		},

		async propose({ nodeId, leaseEpoch, proposal }) {
			// The signer waits for the chain before it answers, which can take a minute or more.
			const response = await post(
				"/internal/v1/runs/propose",
				{ nodeId, leaseEpoch: leaseEpoch.toString(), proposal },
				180_000,
			);
			if (response.status === 409) return "lease_lost";
			if (!response.ok) throw new Error(`proposing a trade failed with ${response.status}`);
			return SignResponse.parse(await response.json());
		},
	};
}

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
	type RunReportEvent,
} from "@maschina/contracts";

export type ClaimedRun = {
	id: string;
	machineId: string;
	occurrenceKey: string;
	dueAt: Date;
	leaseEpoch: bigint;
	leaseExpiresAt: Date;
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
};

export function orchestratorClient(options: {
	url: string;
	token: string;
	fetch?: typeof fetch;
}): Orchestrator {
	const fetchFn = options.fetch ?? fetch;

	const post = (path: string, body: unknown) =>
		fetchFn(new URL(path, options.url), {
			method: "POST",
			headers: {
				authorization: `Bearer ${options.token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(10_000),
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
	};
}

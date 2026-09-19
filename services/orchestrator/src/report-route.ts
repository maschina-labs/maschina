/**
 * Hearing back from nodes.
 *
 * A node says what happened on a run it holds. The record decides whether it still holds it: a report
 * from a node whose lease lapsed, or whose run moved on, is refused rather than written. This route only
 * checks the report is one a node is allowed to make.
 */

import { ReportRequest, ReportResponse, type RunReportEvent } from "@maschina/contracts";
import { MaschinaError, type Result } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { Hono } from "hono";

export type SubmittedReport = {
	nodeId: string;
	runId: string;
	leaseEpoch: bigint;
	event: RunReportEvent;
};

/** Where reports are recorded. The orchestrator's is the database; tests pass their own. */
export type RunReports = {
	report(report: SubmittedReport): Promise<Result<void, MaschinaError>>;
};

function readReport(body: unknown): ReportRequest {
	const parsed = ReportRequest.safeParse(body);
	if (parsed.success) return parsed.data;
	const problems = parsed.error.issues.map(
		(issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`,
	);
	throw new MaschinaError("invalid_input", `the report is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

export function reportRoutes(reports: RunReports) {
	return new Hono<ServiceEnv>().post("/runs/report", async (c) => {
		const body = await c.req.json().catch(() => {
			throw new MaschinaError("invalid_input", "the report is not JSON");
		});
		const report = readReport(body);

		const recorded = await reports.report({
			nodeId: report.nodeId,
			runId: report.runId,
			leaseEpoch: BigInt(report.leaseEpoch),
			event: report.event,
		});
		if (!recorded.ok) throw recorded.error;

		return c.json(ReportResponse.parse({ recorded: true }), 200);
	});
}

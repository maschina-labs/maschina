/**
 * Tells a Crossmint policy refusal apart from any other failure.
 *
 * Crossmint's smart account program enforces a signer's scopes on-chain. A refused transaction fails
 * simulation, and its logs hold an Anchor error thrown from the program's enforcement code, naming the
 * rule. Only that counts as a refusal: a simulation can fail for many other reasons.
 */

const ENFORCEMENT_ERROR =
	/AnchorError thrown in programs\/solana-smart-account\/src\/instructions\/shared\/enforcement\.rs:\d+\. Error Code: (\w+)\. Error Number: \d+\. Error Message: (.+?)\.?$/;

export function classifyCrossmintError(error: unknown): string | undefined {
	if (!(error instanceof Error)) return undefined;
	const start = error.message.indexOf("{");
	if (start < 0) return undefined;
	let body: unknown;
	try {
		body = JSON.parse(error.message.slice(start));
	} catch {
		return undefined;
	}
	if (typeof body !== "object" || body === null) return undefined;
	const { code, simulation } = body as { code?: unknown; simulation?: { logs?: unknown } };
	if (code !== "TRANSACTION_SIMULATION_FAILED" || !Array.isArray(simulation?.logs))
		return undefined;
	for (const line of simulation.logs) {
		const match = typeof line === "string" ? line.match(ENFORCEMENT_ERROR) : null;
		if (match) return `${match[1]}: ${match[2]}`;
	}
	return undefined;
}

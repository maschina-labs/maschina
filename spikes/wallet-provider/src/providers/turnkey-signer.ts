/**
 * Signs machine wallet transactions as the non-root signer, and tells a policy refusal apart from any
 * other failure. Only a refusal counts toward a refusal check, so anything unclear is an error.
 */

export type SignOutcome =
	| { status: "signed"; signedHex: string }
	| { status: "refused"; reason: string }
	| { status: "error"; message: string };

/** The part of Turnkey's API client used for signing. */
export type SignClient = {
	signTransaction(body: {
		signWith: string;
		unsignedTransaction: string;
		type: "TRANSACTION_TYPE_SOLANA";
	}): Promise<{ signedTransaction: string }>;
};

const REFUSED_STATUSES = ["ACTIVITY_STATUS_CONSENSUS_NEEDED", "ACTIVITY_STATUS_REJECTED"];
const POLICY_DENIAL = "PolicyEnginePermissionError";

const field = (value: unknown, key: string): unknown =>
	typeof value === "object" && value !== null && key in value
		? (value as Record<string, unknown>)[key]
		: undefined;

/**
 * Turnkey's own structured signal that policy said no, or undefined. The words in an error message are
 * never enough on their own.
 */
function policyRefusal(error: unknown): string | undefined {
	const status = field(error, "activityStatus");
	if (typeof status === "string" && REFUSED_STATUSES.includes(status)) {
		return `${status}: ${error instanceof Error ? error.message : ""}`;
	}
	const details = field(error, "details");
	if (!Array.isArray(details)) return undefined;
	const denial = details.find((detail) =>
		String(field(detail, "@type") ?? "").endsWith(POLICY_DENIAL),
	);
	if (!denial) return undefined;
	const evaluations = field(denial, "policyEvaluations");
	const outcomes = Array.isArray(evaluations)
		? evaluations.map((e) => String(field(e, "outcome")))
		: [];
	return `${String(field(denial, "message") ?? "denied by policy")} (${outcomes.join(", ")})`;
}

export function turnkeySigner(walletAddress: string, client: SignClient) {
	return {
		async sign(unsignedHex: string): Promise<SignOutcome> {
			try {
				const { signedTransaction } = await client.signTransaction({
					signWith: walletAddress,
					unsignedTransaction: unsignedHex,
					type: "TRANSACTION_TYPE_SOLANA",
				});
				if (!signedTransaction)
					return { status: "error", message: "Turnkey returned no signature" };
				return { status: "signed", signedHex: signedTransaction };
			} catch (error) {
				const refusal = policyRefusal(error);
				if (refusal) return { status: "refused", reason: refusal };
				const message = error instanceof Error ? error.message : String(error);
				const status = field(error, "activityStatus");
				return { status: "error", message: status ? `${status}: ${message}` : message };
			}
		},
	};
}

import { PublicRecord, type PublicTrade } from "@maschina/contracts";

export type RecordState =
	| { status: "loading" }
	| { status: "ready"; trades: PublicTrade[] }
	| { status: "failed" };

/**
 * Reads the gateway's open route. The answer goes through the same strict schema the gateway builds it from, so a
 * field that should never be public is refused here too rather than drawn on a page.
 */
export async function readRecord(
	gateway: string,
	call: typeof fetch = fetch,
): Promise<{ ok: true; trades: PublicTrade[] } | { ok: false }> {
	try {
		const response = await call(`${gateway}/v1/public/record`, {
			headers: { accept: "application/json" },
		});
		if (!response.ok) return { ok: false };
		const parsed = PublicRecord.safeParse(await response.json());
		return parsed.success ? { ok: true, trades: parsed.data.trades } : { ok: false };
	} catch {
		return { ok: false };
	}
}

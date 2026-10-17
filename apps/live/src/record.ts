import { PublicRecord } from "@maschina/contracts";

export type RecordState =
	| { status: "loading" }
	| { status: "ready"; record: PublicRecord }
	| { status: "failed" };

/**
 * Reads the gateway's open route. The answer goes through the same strict schema the gateway builds it from, so a
 * field that should never be public is refused here too rather than drawn on a page.
 */
export async function readRecord(
	gateway: string,
	call: typeof fetch = fetch,
): Promise<{ ok: true; record: PublicRecord } | { ok: false }> {
	try {
		const response = await call(`${gateway}/v1/public/record`, {
			headers: { accept: "application/json" },
		});
		if (!response.ok) return { ok: false };
		const parsed = PublicRecord.safeParse(await response.json());
		return parsed.success ? { ok: true, record: parsed.data } : { ok: false };
	} catch {
		return { ok: false };
	}
}

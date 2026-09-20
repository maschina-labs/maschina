import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import { provisionerClient } from "./provisioner-client.ts";

const SOL = "So11111111111111111111111111111111111111112";
const OWNER = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

const request = {
	ownerWallet: OWNER,
	name: "SOL dip buyer",
	kind: "price_trigger",
	settings: { level: "142000000" },
	limits: { budgetGranted: "20000000", approvedMints: [SOL] },
};

const made = {
	machineId: newId<"machine">(),
	ownerId: newId<"owner">(),
	walletAddress: SOL,
	definitionId: "d".repeat(64),
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const client = (fetchFn: typeof fetch) =>
	provisionerClient({ url: "http://provisioner:4400", token: "tok", fetch: fetchFn });

describe("asking for a machine to be created", () => {
	it("asks the provisioner with the token, and reads the answer", async () => {
		const fetchFn = vi.fn(async () => json(made, 201));
		expect(await client(fetchFn).create(request)).toEqual(made);

		const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
		expect(String(url)).toBe("http://provisioner:4400/internal/v1/machines");
		expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
	});

	it("says the machine was not valid when the provisioner refused to read it", async () => {
		await expect(client(async () => json({}, 400)).create(request)).rejects.toMatchObject({
			code: "invalid_input",
		});
	});

	it("says a machine already exists when the wallet is taken", async () => {
		await expect(client(async () => json({}, 409)).create(request)).rejects.toMatchObject({
			code: "conflict",
		});
	});

	it("says try again later when the provisioner is down or unreachable", async () => {
		await expect(client(async () => json({}, 503)).create(request)).rejects.toMatchObject({
			code: "unavailable",
		});
		await expect(
			client(async () => {
				throw new TypeError("fetch failed");
			}).create(request),
		).rejects.toMatchObject({ code: "unavailable" });
	});
});

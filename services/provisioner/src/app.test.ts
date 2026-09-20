import { MaschinaError, newId } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp, type Provisioner } from "./app.ts";

const token = "g".repeat(40);
const logger = createLogger({ service: "test", level: "silent" });
const SOL = "So11111111111111111111111111111111111111112";
const OWNER = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

const made = {
	machineId: newId<"machine">(),
	ownerId: newId<"owner">(),
	walletAddress: "7xKp4Q9mVbN2sRtL8wEaZc3HfYuD6gJq1oMiTn5vBdRe",
	definitionId: "d".repeat(64),
};

const app = (provisioner: Provisioner) =>
	buildApp({ version: "1.0.0", gatewayToken: token, logger, checks: [], provisioner });

const create = (target: ReturnType<typeof app>, body: unknown) =>
	target.request("/internal/v1/machines", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});

const request = {
	ownerWallet: OWNER,
	name: "SOL dip buyer",
	kind: "price_trigger",
	settings: { level: "142000000" },
	limits: { budgetGranted: "20000000", maxPerTrade: "5000000", approvedMints: [SOL] },
};

describe("the provisioner", () => {
	it("creates a machine and says where its wallet is", async () => {
		const asked: unknown[] = [];
		const res = await create(
			app({
				create: async (machine) => {
					asked.push(machine);
					return { ok: true, value: made };
				},
			}),
			request,
		);

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual(made);
		expect(asked[0]).toMatchObject({
			ownerWallet: OWNER,
			limits: { budgetGranted: 20_000_000n, maxPerTrade: 5_000_000n },
		});
	});

	it("refuses a machine nobody could act on", async () => {
		const never: Provisioner = {
			create: async () => {
				throw new Error("must not be asked");
			},
		};
		expect((await create(app(never), { ...request, limits: undefined })).status).toBe(400);
		expect((await create(app(never), { ...request, ownerWallet: "nope" })).status).toBe(400);
		expect((await create(app(never), { ...request, name: "" })).status).toBe(400);
	});

	it("passes on why a machine could not be made", async () => {
		const res = await create(
			app({
				create: async () => ({
					ok: false,
					error: new MaschinaError("conflict", "that wallet already belongs to a machine"),
				}),
			}),
			request,
		);
		expect(res.status).toBe(409);
	});

	it("refuses a body that is not JSON", async () => {
		const res = await app({
			create: async () => {
				throw new Error("must not be asked");
			},
		}).request("/internal/v1/machines", {
			method: "POST",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: "not json",
		});
		expect(res.status).toBe(400);
	});

	it("is closed to anyone without the gateway's token", async () => {
		const res = await app({ create: async () => ({ ok: true, value: made }) }).request(
			"/internal/v1/machines",
			{ method: "POST", body: JSON.stringify(request) },
		);
		expect(res.status).toBe(401);
	});

	it("reports health and readiness", async () => {
		const target = app({ create: async () => ({ ok: true, value: made }) });
		expect((await target.request("/health")).status).toBe(200);
		expect((await target.request("/ready")).status).toBe(200);
	});
});

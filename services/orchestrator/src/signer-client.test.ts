import type { SignRequest } from "@maschina/contracts";
import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import { signerClient } from "./signer-client.ts";

const request = { proposalId: newId<"proposal">() } as unknown as SignRequest;
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the orchestrator's signer client", () => {
	it("asks with the token and reads the answer", async () => {
		const answer = { status: "signed", proposalId: request.proposalId, signature: "5".repeat(88) };
		const fetchFn = vi.fn(async () => json(answer));
		const client = signerClient({ url: "http://signer:4200", token: "tok", fetch: fetchFn });

		expect(await client.sign(request)).toEqual(answer);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
		expect(String(url)).toBe("http://signer:4200/internal/v1/sign");
		expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
	});

	it("says unavailable when the signer is down or cannot be reached", async () => {
		const down = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({}, 503),
		});
		await expect(down.sign(request)).rejects.toMatchObject({ code: "unavailable" });

		const unreachable = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => {
				throw new TypeError("fetch failed");
			},
		});
		await expect(unreachable.sign(request)).rejects.toMatchObject({ code: "unavailable" });
	});

	it("says the proposal was invalid when the signer refused to read it", async () => {
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({}, 400),
		});
		await expect(client.sign(request)).rejects.toMatchObject({ code: "invalid_input" });
	});

	it("treats anything else as a fault", async () => {
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({}, 500),
		});
		await expect(client.sign(request)).rejects.toMatchObject({ code: "internal" });
	});
});

describe("asking the signer for a machine's funds back", () => {
	const withdrawal = {
		withdrawalId: newId<"withdrawal">(),
		machineId: newId<"machine">(),
		lamports: "250000000",
	};

	it("asks the withdraw route with the token, and reads the answer", async () => {
		const answer = {
			status: "sent",
			withdrawalId: withdrawal.withdrawalId,
			signature: "5".repeat(88),
			to: "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu",
			lamports: "250000000",
		};
		const fetchFn = vi.fn(async () => json(answer));
		const client = signerClient({ url: "http://signer:4200", token: "tok", fetch: fetchFn });

		expect(await client.withdraw(withdrawal)).toEqual(answer);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
		expect(String(url)).toBe("http://signer:4200/internal/v1/withdraw");
		expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
		expect(JSON.parse(String(init.body))).toEqual(withdrawal);
	});

	it("passes a refusal back, because a refusal is an answer and not a fault", async () => {
		const refused = {
			status: "refused",
			withdrawalId: withdrawal.withdrawalId,
			rule: "invalid_amount",
			reason: "a withdrawal moves more than nothing",
		};
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json(refused),
		});

		expect(await client.withdraw(withdrawal)).toEqual(refused);
	});

	it("refuses an answer that does not match the contract", async () => {
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({ status: "maybe" }),
		});

		await expect(client.withdraw(withdrawal)).rejects.toThrow();
	});

	it("says the signer is unreachable rather than inventing an outcome", async () => {
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => {
				throw new Error("connection refused");
			},
		});

		await expect(client.withdraw(withdrawal)).rejects.toMatchObject({ code: "unavailable" });
	});

	it("tells a caller to try later when the signer cannot send right now", async () => {
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({}, 503),
		});

		await expect(client.withdraw(withdrawal)).rejects.toMatchObject({ code: "unavailable" });
	});

	it("says the withdrawal was invalid when the signer would not read it", async () => {
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({}, 400),
		});

		await expect(client.withdraw(withdrawal)).rejects.toMatchObject({ code: "invalid_input" });
	});

	it("treats anything else as a fault", async () => {
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({}, 500),
		});

		await expect(client.withdraw(withdrawal)).rejects.toMatchObject({ code: "internal" });
	});
});

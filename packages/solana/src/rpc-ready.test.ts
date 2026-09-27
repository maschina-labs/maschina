import { describe, expect, it } from "vitest";
import { rpcReachable } from "./rpc.ts";

/** Just enough of an RPC client to answer one question. */
const rpc = (answer: () => Promise<bigint>) =>
	({ getSlot: () => ({ send: answer }) }) as unknown as Parameters<typeof rpcReachable>[0];

describe("whether the chain can be reached", () => {
	it("is yes when the node answers with a slot", async () => {
		expect(await rpcReachable(rpc(async () => 426_070_577n))()).toBe(true);
	});

	it("is no when the node refuses, which is what a bad key looks like", async () => {
		expect(
			await rpcReachable(
				rpc(async () => {
					throw new Error("HTTP error (401): Unauthorized");
				}),
			)(),
		).toBe(false);
	});

	it("is no when the node answers with nothing a chain would say", async () => {
		expect(await rpcReachable(rpc(async () => 0n))()).toBe(false);
	});
});

import { describe, expect, it } from "vitest";
import { rpcSimulator } from "./rpc-simulator.ts";

const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const USDC_ACCOUNT = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

/** An RPC whose simulateTransaction answers with whatever the test gives it. */
function node(answer: unknown, seen: { sent?: [unknown, unknown] } = {}) {
	return {
		simulateTransaction: (transaction: unknown, config: unknown) => {
			seen.sent = [transaction, config];
			return { send: async () => answer };
		},
	} as never;
}

const ok = (accounts: unknown[]) => ({ value: { err: null, accounts } });

describe("simulating through an RPC node", () => {
	it("sends the transaction base64 encoded, unsigned, with a fresh blockhash", async () => {
		const seen: { sent?: [unknown, unknown] } = {};
		await rpcSimulator(node(ok([]), seen))(new Uint8Array([1, 2, 3]), WALLET, [WALLET]);

		const [transaction, config] = seen.sent ?? [];
		expect(transaction).toBe(Buffer.from([1, 2, 3]).toString("base64"));
		expect(config).toMatchObject({
			encoding: "base64",
			// Unsigned at this point, so signatures cannot be verified and the blockhash is replaced.
			sigVerify: false,
			replaceRecentBlockhash: true,
			accounts: { encoding: "jsonParsed", addresses: [WALLET] },
		});
	});

	it("reports the wallet's lamports as the simulation leaves them", async () => {
		const answer = ok([{ lamports: 995_000_000n, owner: SYSTEM_PROGRAM, data: {} }]);

		const result = await rpcSimulator(node(answer))(new Uint8Array(), WALLET, [WALLET]);

		expect(result.ok && result.lamports).toBe(995_000_000n);
	});

	it("pairs each returned account with the address it was asked about", async () => {
		const answer = ok([
			{ lamports: 1n, owner: SYSTEM_PROGRAM, data: {} },
			{ lamports: 2n, owner: TOKEN_PROGRAM, data: { parsed: { type: "account" } } },
		]);

		const result = await rpcSimulator(node(answer))(new Uint8Array(), WALLET, [
			WALLET,
			USDC_ACCOUNT,
		]);

		expect(result.ok && result.accounts).toContainEqual({
			address: USDC_ACCOUNT,
			owner: TOKEN_PROGRAM,
			data: { parsed: { type: "account" } },
		});
	});

	it("leaves out an account that does not exist, rather than inventing an empty one", async () => {
		const answer = ok([{ lamports: 1n, owner: SYSTEM_PROGRAM, data: {} }, null]);

		const result = await rpcSimulator(node(answer))(new Uint8Array(), WALLET, [
			WALLET,
			USDC_ACCOUNT,
		]);

		expect(result.ok && result.accounts.some((a) => a.address === USDC_ACCOUNT)).toBe(false);
	});

	it("reports a transaction that would fail, with the chain's own error", async () => {
		const answer = { value: { err: { InstructionError: [2, "custom"] }, accounts: [] } };

		const result = await rpcSimulator(node(answer))(new Uint8Array(), WALLET, [WALLET]);

		expect(result.ok).toBe(false);
		expect(!result.ok && result.problem).toContain("InstructionError");
	});

	it("says so when the node answers without the accounts it was asked for", async () => {
		// Without the accounts there is nothing to measure, and measuring nothing must never read
		// as a transaction that changed nothing.
		const result = await rpcSimulator(node({ value: { err: null, accounts: null } }))(
			new Uint8Array(),
			WALLET,
			[WALLET],
		);

		expect(result.ok).toBe(false);
	});

	it("says so when the wallet itself comes back missing", async () => {
		const result = await rpcSimulator(node(ok([null])))(new Uint8Array(), WALLET, [WALLET]);

		expect(result.ok).toBe(false);
	});
});

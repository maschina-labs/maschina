import { readFunding } from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { fundingTransaction } from "./funding.ts";

const blockhashes = {
	latest: async () => ({
		blockhash: "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N",
		lastValidBlockHeight: 429_276_872n,
	}),
};
const request = {
	ownerWallet: "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR",
	machineWallet: "6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXaHy",
	usdc: 40_350_000n,
	lamports: 12_000_000n,
};

describe("the funding transaction the gateway hands a wallet", () => {
	it("moves exactly what was asked, from the owner, into the machine", async () => {
		const built = await fundingTransaction(blockhashes, request);
		const facts = await readFunding(Buffer.from(built.transaction, "base64"));

		expect(built.lastValidBlockHeight).toBe("429276872");
		expect(facts.payer).toBe(request.ownerWallet);
		expect(facts.token?.amount).toBe(40_350_000n);
		expect(facts.sol).toEqual({ to: request.machineWallet, lamports: 12_000_000n });
	});

	it("sends only SOL, or only dollars, when that is all that is asked", async () => {
		const sol = await readFunding(
			Buffer.from(
				(await fundingTransaction(blockhashes, { ...request, usdc: 0n })).transaction,
				"base64",
			),
		);
		expect(sol.token).toBeUndefined();
		const dollars = await readFunding(
			Buffer.from(
				(await fundingTransaction(blockhashes, { ...request, lamports: 0n })).transaction,
				"base64",
			),
		);
		expect(dollars.sol).toBeUndefined();
	});
});

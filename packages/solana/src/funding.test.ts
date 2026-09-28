import { getCompiledTransactionMessageDecoder, getTransactionDecoder } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { parseAddress } from "./address.ts";
import { buildFunding, readFunding } from "./funding.ts";
import { ASSOCIATED_TOKEN_PROGRAM, TOKEN_PROGRAM, tokenAccountFor } from "./token-account.ts";

const OWNER = parseAddress("8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR");
const MACHINE = parseAddress("6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXaHy");
const USDC = parseAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

const request = {
	owner: OWNER,
	machine: MACHINE,
	token: { mint: USDC, amount: 40_350_000n, decimals: 6, program: TOKEN_PROGRAM },
	lamports: 12_000_000n,
	blockhash: BLOCKHASH,
	lastValidBlockHeight: 429_276_872n,
};

describe("funding a machine in one approval", () => {
	it("asks only the owner to sign, and the owner pays", async () => {
		const bytes = await buildFunding(request);
		const decoded = getTransactionDecoder().decode(bytes);

		expect(Object.keys(decoded.signatures)).toEqual([OWNER]);
		const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
		expect(message.staticAccounts[0]).toBe(OWNER);
	});

	it("reads back as exactly the dollars and SOL asked for, into the machine's own accounts", async () => {
		const facts = await readFunding(await buildFunding(request));

		expect(facts).toEqual({
			payer: OWNER,
			token: {
				from: await tokenAccountFor({ owner: OWNER, mint: USDC, tokenProgram: TOKEN_PROGRAM }),
				to: await tokenAccountFor({ owner: MACHINE, mint: USDC, tokenProgram: TOKEN_PROGRAM }),
				amount: 40_350_000n,
			},
			sol: { to: MACHINE, lamports: 12_000_000n },
			programs: [ASSOCIATED_TOKEN_PROGRAM, TOKEN_PROGRAM, "11111111111111111111111111111111"],
		});
	});

	it("sends only SOL when no dollars are asked for", async () => {
		const facts = await readFunding(await buildFunding({ ...request, token: undefined }));
		expect(facts.token).toBeUndefined();
		expect(facts.sol).toEqual({ to: MACHINE, lamports: 12_000_000n });
	});

	it("refuses to fund nothing, or to fund the owner's own wallet", async () => {
		await expect(buildFunding({ ...request, token: undefined, lamports: 0n })).rejects.toThrow(
			/nothing/,
		);
		await expect(buildFunding({ ...request, machine: OWNER })).rejects.toThrow(/own wallet/);
	});
});

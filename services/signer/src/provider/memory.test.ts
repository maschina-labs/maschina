import { describe, expect, it } from "vitest";
import { describeWalletProvider } from "./contract.ts";
import { createMemoryWalletProvider, memoryPayment } from "./memory.ts";

const OWNER = "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR";
const RECIPIENT = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const STRANGER = "H8ug7u3sCUiNVvM3QdhtNbWjrn9U1wzvGjV6Nz6chJ4E";

describeWalletProvider("the in-memory provider", {
	provider: () => createMemoryWalletProvider(),
	policy: {
		owner: OWNER,
		recipients: [RECIPIENT],
		approvedPrograms: ["11111111111111111111111111111111"],
		approvedMints: [],
		maxLamportsPerTransfer: 50_000_000n,
	},
	payment: (from, to) => memoryPayment({ from, to, lamports: 1_000_000n }),
	missingWalletId: "missing",
	stranger: STRANGER,
});

describe("the in-memory provider's own rules", () => {
	const policy = {
		owner: OWNER,
		recipients: [],
		approvedPrograms: ["11111111111111111111111111111111"],
		approvedMints: [],
		maxLamportsPerTransfer: 10n,
	};

	it("refuses a payment over the size limit and allows one at it", async () => {
		const provider = createMemoryWalletProvider();
		const created = await provider.createWallet({ label: "limits", policy });
		if (!created.ok) throw created.error;
		const { walletId, address } = created.value;
		const at = await provider.sign(
			walletId,
			memoryPayment({ from: address, to: OWNER, lamports: 10n }),
		);
		const over = await provider.sign(
			walletId,
			memoryPayment({ from: address, to: OWNER, lamports: 11n }),
		);
		expect(at.ok).toBe(true);
		expect(!over.ok && over.error.kind).toBe("refused");
	});

	it("refuses bytes that aren't one of its payments as invalid, and a payment from another wallet as refused", async () => {
		const provider = createMemoryWalletProvider();
		const created = await provider.createWallet({ label: "bytes", policy });
		if (!created.ok) throw created.error;
		const garbage = await provider.sign(created.value.walletId, new Uint8Array([1, 2, 3]));
		expect(!garbage.ok && garbage.error.kind).toBe("invalid");
		const foreign = await provider.sign(
			created.value.walletId,
			memoryPayment({ from: STRANGER, to: OWNER, lamports: 1n }),
		);
		expect(!foreign.ok && foreign.error.kind).toBe("refused");
	});

	it("reports an outage as unavailable and retryable", async () => {
		const provider = createMemoryWalletProvider({ down: true });
		const result = await provider.createWallet({ label: "down", policy });
		expect(!result.ok && result.error).toMatchObject({ kind: "unavailable", retryable: true });
	});

	it("gives every wallet its own address", async () => {
		const provider = createMemoryWalletProvider();
		const a = await provider.createWallet({ label: "a", policy });
		const b = await provider.createWallet({ label: "b", policy });
		expect(a.ok && b.ok && a.value.address !== b.value.address).toBe(true);
	});
});

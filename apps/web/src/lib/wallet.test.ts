import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installWallet } from "../test/wallets.ts";
import {
	choose,
	connect,
	defaultWallet,
	discoverWallets,
	dismissPicker,
	forgetActiveWallet,
	isPicking,
	pickWallet,
	sendTransaction,
	setDefaultWallet,
	signMessage,
	useWallets,
} from "./wallet.ts";

beforeEach(() => {
	localStorage.clear();
	forgetActiveWallet();
	discoverWallets();
});

describe("finding wallets", () => {
	it("lists every Solana wallet that announces itself, and nothing that cannot sign anyone in", () => {
		installWallet("Solflare");
		installWallet("Jupiter");
		installWallet("Ethereum only", "x", {});
		window.dispatchEvent(
			new CustomEvent("wallet-standard:register-wallet", {
				detail: (api: { register(...wallets: unknown[]): void }) =>
					api.register({
						name: "No signing",
						icon: "",
						chains: ["solana:mainnet"],
						features: { "standard:connect": {} },
					}),
			}),
		);
		const { result } = renderHook(() => useWallets());
		const names = result.current.map((wallet) => wallet.name);
		expect(names).toContain("Solflare");
		expect(names).toContain("Jupiter");
		expect(names).not.toContain("No signing");
	});

	it("puts the owner's default first, and assumes no default otherwise", () => {
		installWallet("Backpack");
		installWallet("Solflare");
		const { result } = renderHook(() => useWallets());
		expect(defaultWallet()).toBeUndefined();
		act(() => setDefaultWallet("Solflare"));
		expect(result.current[0]?.name).toBe("Solflare");
		act(() => setDefaultWallet(undefined));
		expect(defaultWallet()).toBeUndefined();
	});
});

describe("connecting", () => {
	it("asks the owner which wallet, then connects that one and no other", async () => {
		const solflare = installWallet("Solflare", "SoLfLaRe");
		const phantom = installWallet("Phantom", "PhAnToM");
		const connecting = connect();
		await vi.waitFor(() => expect(isPicking()).toBe(true));
		choose("Solflare");
		expect(await connecting).toBe("SoLfLaRe");
		expect(solflare.connect).toHaveBeenCalled();
		expect(phantom.connect).not.toHaveBeenCalled();
	});

	it("is cancelled when the picker is closed", async () => {
		const picking = pickWallet();
		dismissPicker();
		await expect(picking).rejects.toThrow("No wallet was chosen.");
	});

	it("signs and sends through the wallet chosen", async () => {
		const jupiter = installWallet("Jupiter", "JuP");
		const connecting = connect();
		await vi.waitFor(() => expect(isPicking()).toBe(true));
		choose("Jupiter");
		await connecting;
		// Bytes 1, 2, 3 are "Ldp" in base58; 4, 5, 6 are "2MJu".
		expect(await signMessage("sign in to Maschina")).toBe("Ldp");
		const sent = jupiter.signMessage.mock.calls[0]?.[0];
		expect(new TextDecoder().decode(sent?.message)).toBe("sign in to Maschina");
		expect(await sendTransaction("AQID")).toBe("2MJu");
		expect(jupiter.signAndSendTransaction.mock.calls[0]?.[0]).toMatchObject({
			chain: "solana:mainnet",
		});
	});

	it("reconnects quietly after a reload to the wallet signed in with", async () => {
		const solflare = installWallet("Solflare", "SoLfLaRe");
		localStorage.setItem("maschina.wallet.active", "Solflare");
		expect(await signMessage("again")).toBe("Ldp");
		expect(solflare.connect).toHaveBeenCalledWith({ silent: true });
	});

	it("says so when nothing is connected", async () => {
		await expect(signMessage("hello")).rejects.toThrow("Connect your wallet first.");
	});
});

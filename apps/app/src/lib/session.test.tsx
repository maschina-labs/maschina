import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { installWallet } from "../test/wallets.ts";
import type { Api } from "./api.ts";
import { createQueryClient } from "./query.ts";
import { useLinkWallet, useSession, useSignIn, useSignOut } from "./session.ts";
import { choose, discoverWallets, forgetActiveWallet, isPicking } from "./wallet.ts";

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const owner = { ownerId: "01a0d758-524f-76a8-bee1-a18a51b66c5e", walletAddress: "WaLLet" };

function fakeApi(answers: Record<string, () => Response>) {
	const sent: Record<string, unknown>[] = [];
	const answer = (key: string, body?: { json?: Record<string, unknown> }) => {
		if (body?.json) sent.push(body.json);
		const found = answers[key];
		if (!found) throw new Error(`nothing stubbed for ${key}`);
		return Promise.resolve(found());
	};
	const api = {
		v1: {
			auth: {
				me: { $get: () => answer("me") },
				challenge: {
					$post: (body: { json: Record<string, unknown> }) => answer("challenge", body),
				},
				verify: { $post: (body: { json: Record<string, unknown> }) => answer("verify", body) },
				"sign-out": { $post: () => answer("sign-out") },
				"link-wallet": {
					$post: (body: { json: Record<string, unknown> }) => answer("link-wallet", body),
				},
			},
		},
	} as unknown as Api;
	return { api, sent };
}

function wrap() {
	const queryClient = createQueryClient();
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
	return { queryClient, wrapper };
}

/** A wallet installed, and chosen in the picker as soon as the picker asks. */
function injectWallet() {
	discoverWallets();
	installWallet("Solflare", "WaLLet");
	const pick = setInterval(() => {
		if (isPicking()) choose("Solflare");
	}, 1);
	return () => clearInterval(pick);
}

let stop: (() => void) | undefined;
afterEach(() => {
	stop?.();
	forgetActiveWallet();
});

describe("who is signed in", () => {
	it("is whoever the API says, not what the app remembers", async () => {
		const { api } = fakeApi({ me: () => json(owner) });
		const { wrapper } = wrap();

		const { result } = renderHook(() => useSession(api), { wrapper });

		await waitFor(() => expect(result.current.data).toEqual(owner));
	});

	it("is nobody when the API refuses, which is not a failure to show anyone", async () => {
		const { api } = fakeApi({ me: () => json({}, 401) });
		const { wrapper } = wrap();

		const { result } = renderHook(() => useSession(api), { wrapper });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toBeNull();
		expect(result.current.error).toBeNull();
	});
});

describe("signing in", () => {
	it("asks for a sentence, signs it, and hands it back", async () => {
		stop = injectWallet();
		const { api, sent } = fakeApi({
			challenge: () => json({ message: "maschina.dev wants you to sign in" }),
			verify: () => json(owner),
		});
		const { queryClient, wrapper } = wrap();

		const { result } = renderHook(() => useSignIn(api, queryClient), { wrapper });
		const signedIn = await result.current.mutateAsync();

		expect(signedIn).toEqual(owner);
		// The sentence signed is the one the API sent, never one the browser made up.
		expect(sent).toEqual([
			{ walletAddress: "WaLLet" },
			{
				walletAddress: "WaLLet",
				message: "maschina.dev wants you to sign in",
				signature: "Ldp",
			},
		]);
		expect(queryClient.getQueryData(["session"])).toEqual(owner);
	});

	it("stops at the first refusal, and says why", async () => {
		stop = injectWallet();
		const { api } = fakeApi({
			challenge: () => json({ error: { message: "that wallet is blocked" } }, 403),
		});
		const { queryClient, wrapper } = wrap();

		const { result } = renderHook(() => useSignIn(api, queryClient), { wrapper });

		await expect(result.current.mutateAsync()).rejects.toThrow("that wallet is blocked");
		expect(queryClient.getQueryData(["session"])).toBeUndefined();
	});
});

describe("signing out", () => {
	it("forgets who was signed in, without waiting to be told again", async () => {
		const { api } = fakeApi({ "sign-out": () => json({}) });
		const { queryClient, wrapper } = wrap();
		queryClient.setQueryData(["session"], owner);

		const { result } = renderHook(() => useSignOut(api, queryClient), { wrapper });
		await result.current.mutateAsync();

		expect(queryClient.getQueryData(["session"])).toBeNull();
	});

	it("ends an email session too, at the gateway's own sign out, for a person with no wallet", async () => {
		const { api } = fakeApi({ "sign-out": () => json({}) });
		(api.v1.auth["sign-out"] as unknown as { $url: () => URL }).$url = () =>
			new URL("https://api.maschina.dev/v1/auth/sign-out");
		const calls: string[] = [];
		const real = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push(`${init?.method} ${String(input)} ${init?.credentials}`);
			return json({});
		}) as typeof fetch;
		try {
			const { queryClient, wrapper } = wrap();
			queryClient.setQueryData(["session"], { ownerId: "o", walletAddress: null, email: "a@b.c" });
			const { result } = renderHook(() => useSignOut(api, queryClient), { wrapper });
			await result.current.mutateAsync();
			expect(calls).toEqual(["POST https://api.maschina.dev/v1/auth/people/sign-out include"]);
			expect(queryClient.getQueryData(["session"])).toBeNull();
		} finally {
			globalThis.fetch = real;
		}
	});
});

describe("linking a wallet", () => {
	it("signs the sentence and hands it to the link route, then is the owner with the wallet", async () => {
		stop = injectWallet();
		const linked = { ownerId: "o", walletAddress: "WaLLet", email: "a@b.c" };
		const { api, sent } = fakeApi({
			challenge: () => json({ message: "Sign me" }),
			"link-wallet": () => json(linked),
		});
		const { queryClient, wrapper } = wrap();
		queryClient.setQueryData(["session"], { ownerId: "o", walletAddress: null, email: "a@b.c" });
		const { result } = renderHook(() => useLinkWallet(api, queryClient), { wrapper });
		await result.current.mutateAsync();
		expect(sent.at(-1)).toMatchObject({ walletAddress: "WaLLet", message: "Sign me" });
		expect(queryClient.getQueryData(["session"])).toEqual(linked);
	});
});

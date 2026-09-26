import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Api } from "./api.ts";
import { createQueryClient } from "./query.ts";
import { useSession, useSignIn, useSignOut } from "./session.ts";

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

function injectWallet() {
	window.solana = {
		connect: vi.fn(async () => ({ publicKey: { toString: () => "WaLLet" } })),
		signMessage: vi.fn(async () => ({ signature: new Uint8Array([1, 2, 3]) })),
	} as unknown as NonNullable<Window["solana"]>;
}

afterEach(() => {
	delete window.solana;
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
		injectWallet();
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
		injectWallet();
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
});

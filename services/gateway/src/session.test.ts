import { newId } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { developmentSession } from "./session.ts";

const WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const owner = { ownerId: newId<"owner">(), walletAddress: WALLET };
const headers = new Headers();

describe("the development stand-in for a session", () => {
	it("treats every request as the owner it was given", async () => {
		const session = developmentSession({
			production: false,
			ownerWallet: WALLET,
			ownerFor: async () => owner,
		});
		expect(await session.ownerOf(headers)).toEqual(owner);
	});

	it("says nobody is signed in when no owner was given", async () => {
		const session = developmentSession({ production: false, ownerFor: async () => owner });
		expect(await session.ownerOf(headers)).toBeUndefined();
	});

	it("says nobody is signed in when that wallet has never signed in", async () => {
		const session = developmentSession({
			production: false,
			ownerWallet: WALLET,
			ownerFor: async () => undefined,
		});
		expect(await session.ownerOf(headers)).toBeUndefined();
	});

	it("refuses to exist in production, so a real signature is the only way in", () => {
		expect(() =>
			developmentSession({ production: true, ownerWallet: WALLET, ownerFor: async () => owner }),
		).toThrow(/production/);
	});

	it("signs nobody in when production is set without a stand-in", async () => {
		const session = developmentSession({ production: true, ownerFor: async () => owner });
		expect(await session.ownerOf(headers)).toBeUndefined();
	});
});

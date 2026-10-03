import { describe, expect, it } from "vitest";
import {
	ManagerMessageRequest,
	SetManagerKeyRequest,
	StartTraderRequest,
	TraderStatus,
} from "./manager.ts";

describe("the manager's shapes", () => {
	it("takes a conversation whose last word is the owner's, Sonnet at medium by default", () => {
		expect(ManagerMessageRequest.parse({ messages: [{ role: "you", text: " hi " }] })).toEqual({
			messages: [{ role: "you", text: "hi" }],
			model: "sonnet",
			effort: "medium",
		});
		expect(
			ManagerMessageRequest.safeParse({ messages: [{ role: "manager", text: "hi" }] }).success,
		).toBe(false);
		expect(
			ManagerMessageRequest.safeParse({ messages: [{ role: "you", text: "hi" }], model: "gpt" })
				.success,
		).toBe(false);
	});

	it("takes only something shaped like an Anthropic key", () => {
		expect(
			SetManagerKeyRequest.safeParse({ key: "sk-ant-api03-abcdefghijklmnopqrstuvwxyz" }).success,
		).toBe(true);
		expect(SetManagerKeyRequest.safeParse({ key: "hello" }).success).toBe(false);
	});

	it("starts a trader with between $5 and $10,000", () => {
		expect(StartTraderRequest.safeParse({ cashUsd: 40 }).success).toBe(true);
		expect(StartTraderRequest.safeParse({ cashUsd: 1 }).success).toBe(false);
	});

	it("says when there is no run", () => {
		expect(TraderStatus.parse({ run: null })).toEqual({ run: null });
	});
});

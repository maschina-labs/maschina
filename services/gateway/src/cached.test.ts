import { describe, expect, it, vi } from "vitest";
import { cached } from "./cached.ts";

describe("sharing one answer", () => {
	it("asks once and serves the same answer inside the window", async () => {
		const work = vi.fn(async () => "answer");
		const desk = cached(work, 30_000);

		expect(await desk.read()).toBe("answer");
		expect(await desk.read()).toBe("answer");
		expect(work).toHaveBeenCalledTimes(1);
	});

	it("asks again once the window has passed", async () => {
		let answers = 0;
		const desk = cached(async () => ++answers, 30_000);

		const now = vi.spyOn(Date, "now");
		try {
			now.mockReturnValue(0);
			expect(await desk.read()).toBe(1);
			now.mockReturnValue(29_999);
			expect(await desk.read()).toBe(1);
			now.mockReturnValue(30_001);
			expect(await desk.read()).toBe(2);
		} finally {
			now.mockRestore();
		}
	});

	it("makes one query for a crowd arriving together, not one each", async () => {
		// The case that matters. Caching only finished answers still lets everybody through at the
		// moment the window expires, which is exactly when a popular page is being hammered.
		let started = 0;
		let release: (value: string) => void = () => {};
		const desk = cached(() => {
			started += 1;
			return new Promise<string>((resolve) => {
				release = resolve;
			});
		}, 30_000);

		const waiting = [desk.read(), desk.read(), desk.read()];
		release("answer");

		expect(await Promise.all(waiting)).toEqual(["answer", "answer", "answer"]);
		expect(started).toBe(1);
	});

	it("does not serve a failure for the rest of the window", async () => {
		// A blip must not become thirty seconds of blip.
		let attempt = 0;
		const desk = cached(async () => {
			attempt += 1;
			if (attempt === 1) throw new Error("the database had a moment");
			return "answer";
		}, 30_000);

		await expect(desk.read()).rejects.toThrow("the database had a moment");
		expect(await desk.read()).toBe("answer");
	});

	it("still gives the rejection to everyone already waiting on it", async () => {
		const desk = cached(async () => {
			throw new Error("no");
		}, 30_000);

		const waiting = [desk.read(), desk.read()];
		await expect(Promise.allSettled(waiting)).resolves.toEqual([
			{ status: "rejected", reason: expect.any(Error) },
			{ status: "rejected", reason: expect.any(Error) },
		]);
	});
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarize, timeEach } from "./timing.ts";

describe("summarize", () => {
	it("reports the fastest, middle and slowest time, rounded to milliseconds", () => {
		assert.deepEqual(summarize([300.4, 100.2, 200.6]), {
			runs: 3,
			minMs: 100,
			medianMs: 201,
			maxMs: 300,
		});
	});

	it("takes the mean of the two middle times when there is an even number", () => {
		assert.equal(summarize([1, 2, 3, 10]).medianMs, 3);
	});

	it("refuses an empty list, since there is nothing to report", () => {
		assert.throws(() => summarize([]), /no timings/);
	});
});

describe("timeEach", () => {
	it("runs the step the given number of times, one after another, and times each run", async () => {
		let clock = 0;
		const order: number[] = [];
		const times = await timeEach(
			3,
			async (i) => {
				order.push(i);
				clock += (i + 1) * 100;
			},
			() => clock,
		);
		assert.deepEqual(order, [0, 1, 2]);
		assert.deepEqual(times, [100, 200, 300]);
	});
});

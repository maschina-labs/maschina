import { describe, expect, it } from "vitest";
import { firstRunStep } from "./start-here.tsx";

const machine = (state: "draft" | "ready" | "running" | "paused" | "stopped") => ({
	machineId: "m",
	state,
});

describe("the first run", () => {
	it("starts by connecting", () => {
		expect(firstRunStep({ signedIn: false, machines: undefined })).toEqual({ step: 1 });
	});

	it("then making a machine", () => {
		expect(firstRunStep({ signedIn: true, machines: [] })).toEqual({ step: 2 });
	});

	it("then starting the one made, by opening it", () => {
		expect(firstRunStep({ signedIn: true, machines: [machine("ready")] })).toEqual({
			step: 3,
			machineId: "m",
		});
	});

	it("is done once any machine has started", () => {
		expect(firstRunStep({ signedIn: true, machines: [machine("running")] })).toBeUndefined();
		expect(
			firstRunStep({ signedIn: true, machines: [machine("ready"), machine("paused")] }),
		).toBeUndefined();
	});

	it("waits, rather than guessing, while the machines are still loading", () => {
		expect(firstRunStep({ signedIn: true, machines: undefined })).toBeUndefined();
	});
});

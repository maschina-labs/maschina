import { describe, expect, it } from "vitest";
import { commandsFor, matches } from "./commands.ts";

const commands = commandsFor([{ machineId: "m1", name: "Range Finder", state: "running" }]);

describe("the command palette's commands", () => {
	it("has every page, and opening and following each machine", () => {
		const labels = commands.map((command) => command.label);
		expect(labels).toContain("PORTFOLIO");
		expect(labels).toContain("RANGE FINDER");
		expect(labels).toContain("FOLLOW RANGE FINDER");
		expect(commands.find((command) => command.id === "follow-m1")?.search).toEqual({
			machine: "m1",
		});
	});

	it("matches every typed word, in any order, against the label and hint", () => {
		const find = (typed: string) =>
			commands.filter((command) => matches(command, typed)).map((c) => c.id);
		expect(find("range")).toEqual(["open-m1", "follow-m1"]);
		expect(find("follow range")).toEqual(["follow-m1"]);
		expect(find("globe")).toEqual(["network"]);
		expect(find("")).toHaveLength(commands.length);
	});
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { commandsFor } from "../lib/commands.ts";
import { CommandPaletteView } from "./command-palette.tsx";

const commands = commandsFor([{ machineId: "m1", name: "Range Finder", state: "running" }]);

describe("the command palette", () => {
	it("narrows as you type and runs the first match on Enter", () => {
		const onRun = vi.fn();
		render(<CommandPaletteView commands={commands} onRun={onRun} onClose={vi.fn()} />);

		const box = screen.getByRole("textbox", { name: "Search commands" });
		fireEvent.change(box, { target: { value: "follow range" } });
		expect(screen.getAllByRole("button")).toHaveLength(1);
		fireEvent.keyDown(box, { key: "Enter" });
		expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ id: "follow-m1" }));
	});

	it("moves with the arrow keys, and closes on Escape", () => {
		const onRun = vi.fn();
		const onClose = vi.fn();
		render(<CommandPaletteView commands={commands} onRun={onRun} onClose={onClose} />);

		const box = screen.getByRole("textbox", { name: "Search commands" });
		fireEvent.keyDown(box, { key: "ArrowDown" });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ id: "intel" }));
		fireEvent.keyDown(box, { key: "Escape" });
		expect(onClose).toHaveBeenCalled();
	});
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import limitsSource from "../../../packages/runtime/src/machine-limits.ts?raw";
import sdkSource from "../../../packages/sdk/src/machine.ts?raw";
import { BuilderWorkbench } from "./builder-workbench.tsx";

describe("builder source workbench", () => {
	it("shows a selectable real excerpt with its correct source link", () => {
		render(<BuilderWorkbench />);
		const code = screen.getByRole("region", { name: "Decisions" }).querySelector("code");
		expect(sdkSource).toContain(code?.textContent);
		expect(code?.textContent).toContain('kind: "skip"');
		expect(code).toHaveClass("font-sans");
		expect(
			within(screen.getByRole("region", { name: "Decisions" })).getByRole("link"),
		).toHaveAttribute(
			"href",
			"https://github.com/maschina-labs/maschina/blob/main/packages/sdk/src/machine.ts",
		);
	});
	it("changes the actual code and explanation when another source is selected", () => {
		render(<BuilderWorkbench />);
		fireEvent.click(screen.getByRole("button", { name: "Limits" }));
		expect(screen.getByRole("button", { name: "Limits" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", { name: "Decisions" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		const region = screen.getByRole("region", { name: "Limits" });
		expect(limitsSource).toContain(region.querySelector("code")?.textContent);
		expect(region.querySelector("code")?.textContent).toContain("approvedMints");
		expect(screen.getByText(/spending caps, approved tokens/)).toBeInTheDocument();
	});
	it("lets the reader pause and resume the streaming code", () => {
		render(<BuilderWorkbench />);
		fireEvent.click(screen.getByRole("button", { name: "Pause code motion" }));
		expect(screen.getByRole("button", { name: "Resume code motion" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		fireEvent.click(screen.getByRole("button", { name: "Resume code motion" }));
		expect(screen.getByRole("button", { name: "Pause code motion" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});
});

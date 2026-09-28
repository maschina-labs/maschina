import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManagerView } from "./manager.tsx";

describe("the manager", () => {
	it("shows each suggestion, holds applying back, and lets you dismiss it", () => {
		const onDismiss = vi.fn();
		render(
			<ManagerView
				suggestions={[
					{
						id: "s",
						machineId: "m",
						machine: "RANGE FINDER",
						title: "IT IS STOPPED",
						detail: "WITHDRAW WHAT IT HOLDS",
					},
				]}
				onDismiss={onDismiss}
			/>,
		);

		expect(screen.getByText("IT IS STOPPED")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "APPLY" })).toBeDisabled();
		fireEvent.click(screen.getByRole("button", { name: "DISMISS" }));
		expect(onDismiss).toHaveBeenCalledWith("s");
	});
});

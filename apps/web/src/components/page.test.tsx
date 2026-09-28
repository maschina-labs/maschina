import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Coming, Later, Page, Part, Row } from "./page.tsx";

describe("the page frame", () => {
	it("gives every page a coded heading and titled parts", () => {
		render(
			<Page code="WALLET // HOME" title="YOUR WALLET">
				<Part title="IDLE">
					<Row term="SOL" value="0.10" />
					<Coming>LIVE BALANCES ARRIVE LATER</Coming>
					<Later>STAKE</Later>
				</Part>
			</Page>,
		);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("YOUR WALLET");
		expect(screen.getByRole("region", { name: "IDLE" })).toHaveTextContent("0.10");
		expect(screen.getByRole("button", { name: "STAKE" })).toBeDisabled();
	});
});

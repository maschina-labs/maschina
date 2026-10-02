import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Bento, Tile } from "./bento.tsx";

describe("the tiles", () => {
	it("lays tiles out by size, each naming itself", () => {
		render(
			<Bento label="Terminal">
				<Tile label="SOL">120.00</Tile>
				<Tile size="wide" label="Range Finder" />
				<Tile size="large" />
				<Tile size="hero" />
			</Bento>,
		);

		expect(screen.getByRole("region", { name: "Terminal" })).toBeInTheDocument();
		expect(screen.getByRole("article", { name: "SOL" })).toHaveClass("col-span-1");
		expect(screen.getByRole("article", { name: "Range Finder" })).toHaveClass("col-span-2");
		expect(screen.getByText("120.00")).toBeInTheDocument();
	});
});

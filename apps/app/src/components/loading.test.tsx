import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HaltBanner, Loading } from "./loading.tsx";

describe("waiting and halting", () => {
	it("says what it is waiting for", () => {
		render(<Loading what="LOADING MACHINES" />);

		expect(screen.getByRole("status")).toHaveTextContent("LOADING MACHINES");
	});

	it("says a halt is in force, and why", () => {
		render(<HaltBanner reason="price feed disagreeing" />);

		expect(screen.getByRole("alert")).toHaveTextContent("HALTED");
		expect(screen.getByRole("alert")).toHaveTextContent("PRICE FEED DISAGREEING");
	});
});

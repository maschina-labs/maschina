import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogoMark } from "./brand.tsx";

describe("the mark", () => {
	it("is named for people who cannot see it", () => {
		render(<LogoMark />);
		expect(screen.getByRole("img", { name: "Maschina" })).toBeInTheDocument();
	});
});

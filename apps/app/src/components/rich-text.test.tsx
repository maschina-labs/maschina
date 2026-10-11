import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "./rich-text.tsx";

describe("the manager's answers", () => {
	it("reads headings, bold and both kinds of list, and nothing else", () => {
		const { container } = render(
			<RichText
				text={
					"## Ranked\n**1. SI** is first\n- deep pool\n- steady\n1. SI\n2. e/acc\nplain <b>not markup</b> [not](a link)"
				}
			/>,
		);
		expect(screen.getByText("Ranked")).toHaveClass("font-medium");
		expect(screen.getByText("1. SI").tagName).toBe("STRONG");
		expect(container.querySelectorAll("ul li")).toHaveLength(2);
		expect(container.querySelectorAll("ol li")).toHaveLength(2);
		expect(container.querySelector("b")).toBeNull();
		expect(container.querySelector("a")).toBeNull();
		expect(screen.getByText(/plain <b>not markup<\/b>/)).toBeInTheDocument();
	});

	it("leaves an unclosed star as written", () => {
		render(<RichText text={"**half"} />);
		expect(screen.getByText("**half")).toBeInTheDocument();
	});
});

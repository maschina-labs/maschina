import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { rich } from "./rich.tsx";

describe("a sentence with a link in it", () => {
	it("puts the link where the braces are, so a language can order its words its own way", () => {
		render(
			<p>
				{rich("Use the {link} page instead.", {
					link: <a href="/disclosure">security disclosure</a>,
				})}
			</p>,
		);
		expect(screen.getByRole("paragraph")).toHaveTextContent(
			"Use the security disclosure page instead.",
		);
		expect(screen.getByRole("link", { name: "security disclosure" })).toBeInTheDocument();
		render(<p>{rich("{link} ist hier.", { link: <b>Das</b> })}</p>);
		expect(screen.getAllByRole("paragraph")[1]).toHaveTextContent("Das ist hier.");
	});

	it("leaves a brace with nothing to put in it, so a missing part shows", () => {
		render(<p>{rich("Hello {name}", {})}</p>);
		expect(screen.getByRole("paragraph")).toHaveTextContent("Hello {name}");
	});
});

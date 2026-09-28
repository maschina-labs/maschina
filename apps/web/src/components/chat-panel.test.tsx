import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Conversation } from "./chat-panel.tsx";

describe("a conversation with a machine", () => {
	it("shows who said what, in order", () => {
		render(
			<Conversation
				lines={[
					{ from: "you", text: "WHY DID YOU LAST TRADE?" },
					{
						from: "machine",
						text: "I BOUGHT AT 118.78 BECAUSE THE PRICE REACHED MY BUY LINE AT 118.80.",
					},
				]}
			/>,
		);

		const items = screen.getAllByRole("listitem");
		expect(items[0]).toHaveTextContent("YOU");
		expect(items[1]).toHaveTextContent("MACHINE");
		expect(items[1]).toHaveTextContent("BUY LINE AT 118.80");
	});
});

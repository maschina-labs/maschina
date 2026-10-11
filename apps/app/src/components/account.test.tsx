import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderAt, standIn } from "../test/app.tsx";

describe("the account in the corner", () => {
	it("shows the email of a person who signed in without a wallet, not a blank", async () => {
		standIn({ person: "ash@example.com" });
		renderAt("/");
		expect(await screen.findByText("ash@example.com")).toBeInTheDocument();
	});
});

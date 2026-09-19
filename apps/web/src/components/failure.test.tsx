import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Failure, failureMessage } from "./failure.tsx";

describe("when a page breaks", () => {
	it("says so, and says what went wrong", () => {
		render(<Failure message="the gateway timed out" />);

		expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
		expect(screen.getByRole("alert")).toHaveTextContent("the gateway timed out");
	});

	it("reads the message from an error", () => {
		expect(failureMessage(new Error("no such machine"))).toBe("no such machine");
	});

	it("still says something readable when what was thrown is not an error", () => {
		expect(failureMessage("a string")).toBe("Unexpected error");
		expect(failureMessage(undefined)).toBe("Unexpected error");
	});
});

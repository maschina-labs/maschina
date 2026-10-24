import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import redirects from "../public/_redirects?raw";
import { App } from "./app.tsx";
import { CONTENT_PATHS } from "./content-paths.ts";
import { LIVE } from "./links.ts";
import { ROUTES } from "./routes.ts";

vi.mock("./live/app.tsx", () => ({
	LiveApp: () => <main aria-label="Live Record">Existing public record</main>,
}));

describe("the public record on the company site", () => {
	it("renders the record on /live instead of a blank page or redirect", async () => {
		render(<App authUrl="https://app.maschina.dev" path="/live" />);
		expect(await screen.findByText("Existing public record")).toBeInTheDocument();
		expect(screen.getByRole("main", { name: "Live Record" })).toBeInTheDocument();
	});
	it("links to the internal route and includes it among indexable pages", () => {
		expect(LIVE).toBe("/live");
		expect(ROUTES["/live"]).toBe("Live Record");
		expect(CONTENT_PATHS).toContain("/live");
	});
	it("does not redirect the new route back to the old hostname", () => {
		expect(redirects).not.toContain("live.maschina.dev");
	});
});

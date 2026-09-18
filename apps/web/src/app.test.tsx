import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createApi } from "./lib/api.ts";
import { createQueryClient } from "./lib/query.ts";
import { createAppRouter } from "./router.tsx";

function renderAt(path: string, fetchFn: typeof fetch) {
	const queryClient = createQueryClient();
	const router = createAppRouter({ api: createApi("http://gateway.test", fetchFn), queryClient });
	router.history = createMemoryHistory({ initialEntries: [path] });
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}

const up: typeof fetch = async () =>
	Response.json({ status: "ok", service: "gateway", version: "1", time: new Date().toISOString() });
const down: typeof fetch = async () => Response.json({}, { status: 404 });

describe("the web app", () => {
	it("says what a machine is and what it cannot do", async () => {
		renderAt("/", up);

		expect(
			await screen.findByRole("heading", {
				name: /a machine with its own wallet, a budget it cannot exceed/i,
			}),
		).toBeInTheDocument();
		expect(await screen.findByText("Its own wallet")).toBeInTheDocument();
		expect(await screen.findByText("It cannot withdraw your money")).toBeInTheDocument();
	});

	it("does not need the API to say anything", async () => {
		// The landing page is the first thing anyone sees, often before any service is running. It has
		// to read correctly on its own rather than showing an error where the product should be.
		renderAt("/", down);

		expect(
			await screen.findByRole("heading", {
				name: /a machine with its own wallet, a budget it cannot exceed/i,
			}),
		).toBeInTheDocument();
		expect(screen.queryByText(/unreachable/i)).not.toBeInTheDocument();
	});

	it("promises nothing about returns", async () => {
		renderAt("/", up);
		const page = document.body.textContent ?? "";

		// The voice rules: nothing that reads like a yield product, ever, anywhere public.
		for (const forbidden of ["guaranteed", "profit", "returns", "APY", "earn "]) {
			expect(page.toLowerCase()).not.toContain(forbidden.toLowerCase());
		}
	});

	it("shows a not-found page for unknown routes", async () => {
		renderAt("/nowhere", up);
		expect(await screen.findByText("There's nothing here.")).toBeInTheDocument();
	});
});

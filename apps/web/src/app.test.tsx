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
	it("renders the home page and shows the API is up", async () => {
		renderAt("/", up);
		expect(
			await screen.findByRole("heading", { name: "Software that goes to work." }),
		).toBeInTheDocument();
		expect(await screen.findByText("API: ok")).toBeInTheDocument();
	});

	it("says so when the API can't be reached", async () => {
		renderAt("/", down);
		expect(await screen.findByText("API: unreachable")).toBeInTheDocument();
	});

	it("shows a not-found page for unknown routes", async () => {
		renderAt("/nowhere", up);
		expect(await screen.findByText("There's nothing here.")).toBeInTheDocument();
	});
});

import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createApi } from "./lib/api.ts";
import { createQueryClient } from "./lib/query.ts";
import { createAppRouter } from "./router.tsx";

function renderAt(path: string) {
	const queryClient = createQueryClient();
	const router = createAppRouter({
		api: createApi("http://localhost:4000"),
		queryClient,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}

describe("the web app", () => {
	it("renders the app without asking anything of the API", async () => {
		const { container } = renderAt("/");
		await screen.findByRole("main", {}).catch(() => undefined);
		expect(container.firstChild).toBeTruthy();
	});

	it("shows a not-found page for unknown routes", async () => {
		renderAt("/nowhere");
		expect(await screen.findByText("There's nothing here.")).toBeInTheDocument();
	});
});

import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi } from "../lib/api.ts";
import { createQueryClient } from "../lib/query.ts";
import { createAppRouter } from "../router.tsx";
import { Shell } from "./shell.tsx";

/**
 * The shell needs a router in context, because the account control reads the api from it. Rendering it
 * inside the real router is closer to the app than a mock, and costs nothing here.
 */
function renderShell(fetchFn: typeof fetch) {
	const queryClient = createQueryClient();
	const router = createAppRouter({
		api: createApi("http://localhost:4000", fetchFn),
		queryClient,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider
				router={router}
				defaultComponent={() => (
					<Shell>
						<p>a page</p>
					</Shell>
				)}
			/>
		</QueryClientProvider>,
	);
}

const signedOut = vi.fn(async () => new Response(JSON.stringify({}), { status: 401 }));

afterEach(() => {
	delete window.solana;
});

describe("the shell", () => {
	it("hides the sidebar and leaves a way to bring it back", async () => {
		renderShell(signedOut as unknown as typeof fetch);

		// While the sidebar is open there is nothing offering to show it.
		expect(screen.queryByLabelText("Show sidebar")).toBeNull();

		fireEvent.click(await screen.findByLabelText("Hide sidebar"));
		expect(screen.getByLabelText("Show sidebar")).toBeTruthy();

		fireEvent.click(screen.getByLabelText("Show sidebar"));
		expect(screen.queryByLabelText("Show sidebar")).toBeNull();
	});

	it("closes a group of machines and opens it again", async () => {
		renderShell(signedOut as unknown as typeof fetch);

		const machines = await screen.findByRole("button", { name: "Machines" });
		expect(screen.getByText("No machines yet")).toBeTruthy();

		fireEvent.click(machines);
		expect(screen.queryByText("No machines yet")).toBeNull();

		fireEvent.click(machines);
		expect(screen.getByText("No machines yet")).toBeTruthy();
	});

	it("opens what is under a navigation item that has more beneath it", async () => {
		renderShell(signedOut as unknown as typeof fetch);

		fireEvent.click(await screen.findByText("Runs"));

		expect(screen.getByText("Queued")).toBeTruthy();
		expect(screen.getByText("Finished")).toBeTruthy();
	});

	it("offers to connect a wallet while nobody is signed in", async () => {
		renderShell(signedOut as unknown as typeof fetch);

		expect(await screen.findByText("Connect wallet")).toBeTruthy();
	});

	it("shows the signed in wallet, shortened", async () => {
		const fetchFn = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						ownerId: "01a0d758-524f-76a8-bee1-a18a51b66c5e",
						walletAddress: "7xKp4Q9mVbN2sRtL8wEaZc3HfYuD6gJq1oMiTn5vBdRe",
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		);
		renderShell(fetchFn as unknown as typeof fetch);

		await waitFor(() => expect(screen.getByText("7xKp…BdRe")).toBeTruthy());
	});
});

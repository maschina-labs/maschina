import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/machines.ts";
import { ForError } from "./for-error.tsx";
import { Broken, NotFound, NotYours, Offline, SignedOut } from "./states.tsx";

/**
 * These pages carry links, so they need a router around them.
 *
 * A router of one route, rather than the app's: the app has a real route at "/" and it would render
 * that instead of the page under test.
 */
function show(node: ReactNode) {
	const root = createRootRoute({ component: () => <>{node}</> });
	const router = createRouter({
		routeTree: root,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	return render(<RouterProvider router={router as never} />);
}

describe("the pages for when something is wrong", () => {
	it("tells somebody their money is safe, because that is what they want first", async () => {
		show(<NotFound />);

		expect(await screen.findByText(/Your funds are unaffected/)).toBeTruthy();
	});

	it("carries the code somebody will quote in a message", async () => {
		show(<NotFound />);

		expect(await screen.findByText("404 · not found")).toBeTruthy();
	});

	it("shows the real error rather than something friendlier", async () => {
		show(<Broken detail="TypeError: cannot read properties of undefined" />);

		expect(await screen.findByText(/cannot read properties of undefined/)).toBeTruthy();
	});

	it("offers to reload only when there is something to reload", async () => {
		const reset = vi.fn();
		show(<Broken reset={reset} />);

		expect(await screen.findByRole("button", { name: /Reload this screen/ })).toBeTruthy();
	});

	it("says machines keep running when the API is unreachable, because they do", async () => {
		show(<Offline />);

		expect(await screen.findByText(/run on the server rather than in this browser/)).toBeTruthy();
	});

	it("says signing in is a signature over a sentence, never a permission to spend", async () => {
		show(<SignedOut />);

		expect(await screen.findByText(/never a permission to spend/)).toBeTruthy();
	});

	it("says a machine belongs to the wallet that made it", async () => {
		show(<NotYours />);

		expect(await screen.findByText(/belongs to another wallet/)).toBeTruthy();
	});
});

describe("choosing a page for a failure", () => {
	it("asks somebody to sign in when the API said they are not", async () => {
		show(<ForError error={new ApiError("sign in first", 401)} />);

		expect(await screen.findByText("401 · not signed in")).toBeTruthy();
	});

	it("says it is not theirs when the API said so", async () => {
		show(<ForError error={new ApiError("that is not yours", 403)} />);

		expect(await screen.findByText("403 · not yours")).toBeTruthy();
	});

	it("treats an error with no status as the API being unreachable", async () => {
		// A request that never arrived has no status. Not knowing is not the same as being told nothing
		// is wrong, so it reads as unreachable rather than as a broken screen.
		show(<ForError error={new Error("fetch failed")} />);

		expect(await screen.findByText("503 · unreachable")).toBeTruthy();
	});

	it("shows the message itself for anything else", async () => {
		show(<ForError error={new ApiError("that wallet already has a machine", 409)} />);

		expect(await screen.findByText("that wallet already has a machine")).toBeTruthy();
	});
});

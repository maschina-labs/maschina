import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTIONS } from "../lib/answers.ts";

const state = vi.hoisted(() => ({ signedIn: true }));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ options: { context: { api: {} } } }),
}));
vi.mock("../lib/session.ts", () => ({
	useSession: () => ({ data: state.signedIn ? { ownerId: "o" } : null }),
}));
vi.mock("../lib/machines.ts", async (real) => ({
	...(await real<object>()),
	useMachines: () => ({ data: [{ machineId: "a", name: "Range Finder" }] }),
	useMachine: () => ({
		data: {
			machineId: "a",
			name: "Range Finder",
			kind: "range",
			state: "running",
			settings: { buyLevel: "118800000", sellLevel: "121200000" },
			result: { position: "0", realised: "0", trades: 0 },
			budget: { granted: "0", available: "0" },
		},
	}),
	useRecord: () => ({ data: [] }),
}));

const { ChatPanel } = await import("./chat-panel.tsx");

beforeEach(() => {
	state.signedIn = true;
});

describe("talking to your machines", () => {
	it("asks you to pick one, then answers from its own record", () => {
		render(<ChatPanel onClose={vi.fn()} />);
		expect(screen.getByText("PICK A MACHINE TO TALK TO")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "RANGE FINDER" }));
		fireEvent.click(screen.getByRole("button", { name: QUESTIONS[0] }));
		// The question now appears twice: on its button, and in the conversation, with an answer under it.
		expect(screen.getAllByText(QUESTIONS[0])).toHaveLength(2);
		expect(screen.getByText("YOU")).toBeInTheDocument();
		expect(screen.getAllByText("MACHINE").length).toBeGreaterThan(0);
	});

	it("asks you to connect before you can talk to anything", () => {
		state.signedIn = false;
		render(<ChatPanel onClose={vi.fn()} docked />);
		expect(screen.getByText("CONNECT TO TALK TO YOUR MACHINES")).toBeInTheDocument();
	});

	it("has a room for everyone, and closes", () => {
		const onClose = vi.fn();
		render(<ChatPanel onClose={onClose} />);
		fireEvent.click(screen.getByRole("button", { name: "GLOBAL" }));
		expect(screen.getByText("THE ROOM FOR EVERYONE RUNNING MACHINES")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(onClose).toHaveBeenCalledOnce();
	});
});

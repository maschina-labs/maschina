import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactPage } from "./contact-page.tsx";

const AUTH = "https://auth.maschina.dev";

let posts: { url: string; body: Record<string, string> }[];
let status: number;

beforeEach(() => {
	// The head's moving background measures itself; a test page has no layout to measure.
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	posts = [];
	status = 200;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init?: RequestInit) => {
			if (String(url).endsWith("/v1/contact")) {
				posts.push({ url: String(url), body: JSON.parse(String(init?.body)) });
				return new Response("{}", { status });
			}
			return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
		}),
	);
});
afterEach(() => vi.unstubAllGlobals());

function fill(
	name = "Ada Lovelace",
	email = "ada@example.com",
	message = "My machine stopped this morning.",
) {
	fireEvent.change(screen.getByLabelText("Your name"), { target: { value: name } });
	fireEvent.change(screen.getByLabelText("Your email"), { target: { value: email } });
	fireEvent.change(screen.getByLabelText("Your message"), { target: { value: message } });
}

describe("the contact page", () => {
	it("has the held mesh head, and a form on a black sheet over it", () => {
		const { container } = render(<ContactPage authUrl={AUTH} />);
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Contact");
		const head = container.querySelector("[data-head]") as HTMLElement;
		expect(head.className).toContain("sticky");
		expect(head.nextElementSibling).toBe(container.querySelector("[data-sheet]"));
		expect(document.title).toContain("Contact");
	});

	it("asks who the message is for, as one of four, with support chosen to begin with", () => {
		render(<ContactPage authUrl={AUTH} />);
		const group = screen.getByRole("radiogroup", { name: "Who is it for" });
		const options = within(group).getAllByRole("radio");
		expect(options.map((option) => option.getAttribute("value"))).toEqual([
			"support",
			"billing",
			"legal",
			"abuse",
		]);
		expect(within(group).getByRole("radio", { name: /Support/ })).toBeChecked();
	});

	it("sends the message to the API with the chosen topic, then says it was sent and shows the form no more", async () => {
		render(<ContactPage authUrl={AUTH} />);
		fireEvent.click(screen.getByRole("radio", { name: /Billing/ }));
		fill();
		fireEvent.click(screen.getByRole("button", { name: "Send message" }));
		await waitFor(() => expect(screen.getByText("Message sent.")).toBeInTheDocument());
		expect(posts).toHaveLength(1);
		expect(posts[0]?.url).toMatch(/\/v1\/contact$/);
		expect(posts[0]?.body).toMatchObject({
			topic: "billing",
			name: "Ada Lovelace",
			email: "ada@example.com",
			message: "My machine stopped this morning.",
			website: "",
		});
		expect(screen.queryByLabelText("Your message")).toBeNull();
	});

	it("keeps what was typed and says what went wrong, in plain words, when it cannot be sent", async () => {
		render(<ContactPage authUrl={AUTH} />);
		fill();
		for (const [code, words] of [
			[429, /too many messages/i],
			[503, /cannot be sent right now/i],
			[400, /check the fields/i],
		] as const) {
			status = code;
			fireEvent.click(screen.getByRole("button", { name: "Send message" }));
			await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(words));
			expect(screen.getByLabelText("Your message")).toHaveValue("My machine stopped this morning.");
		}
		// The last answer was a refusal of the fields: that one asks for a fix, not another address.
		status = 503;
		fireEvent.click(screen.getByRole("button", { name: "Send message" }));
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("support@maschina.dev"),
		);
	});

	it("does not send twice while it is sending", async () => {
		render(<ContactPage authUrl={AUTH} />);
		fill();
		const send = screen.getByRole("button", { name: "Send message" });
		fireEvent.click(send);
		fireEvent.click(send);
		await waitFor(() => expect(screen.getByText("Message sent.")).toBeInTheDocument());
		expect(posts).toHaveLength(1);
	});

	it("has a hidden field no person fills, kept out of sight and out of the tab order", () => {
		const { container } = render(<ContactPage authUrl={AUTH} />);
		const trap = container.querySelector("input[name=website]") as HTMLInputElement;
		expect(trap).not.toBeNull();
		expect(trap.tabIndex).toBe(-1);
		expect(trap.closest("[aria-hidden=true]")).not.toBeNull();
		expect(trap.autocomplete).toBe("off");
	});

	it("marks every field as needed, and sends a security problem to the disclosure page instead", () => {
		render(<ContactPage authUrl={AUTH} />);
		for (const label of ["Your name", "Your email", "Your message"])
			expect(screen.getByLabelText(label)).toBeRequired();
		expect(screen.getByLabelText("Your email")).toHaveAttribute("type", "email");
		expect(screen.getByLabelText("Your message")).toHaveAttribute("minlength", "10");
		expect(screen.getByRole("link", { name: "security disclosure" })).toHaveAttribute(
			"href",
			"/disclosure",
		);
	});
});

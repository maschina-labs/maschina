import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startAnalytics } from "./analytics.ts";
import { OPEN_PREFERENCES, savePreference } from "./preferences.ts";

const KEY = "phc_test_public_key";
const HOST = "https://us.i.posthog.com";

let sent: { url: string; body: Record<string, unknown> }[];
let stops: (() => void)[] = [];

/** Starts analytics and remembers how to stop it, so one test never hears another's choice. */
function start(settings: Parameters<typeof startAnalytics>[0]) {
	const stop = startAnalytics(settings);
	stops.push(stop);
}

function clearCookies() {
	for (const cookie of document.cookie.split("; ")) {
		const name = cookie.split("=")[0];
		// biome-ignore lint/suspicious/noDocumentCookie: a test clearing its own cookies, with no Cookie Store API in jsdom
		if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
	}
}

beforeEach(() => {
	sent = [];
	clearCookies();
	window.localStorage.clear();
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init?: RequestInit) => {
			sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
			return new Response("{}", { status: 200 });
		}),
	);
});
afterEach(() => {
	for (const stop of stops) stop();
	stops = [];
	vi.unstubAllGlobals();
	clearCookies();
});

describe("analytics", () => {
	it("sends nothing, and stores nothing, until the visitor has accepted optional cookies", () => {
		start({ key: KEY, host: HOST });
		expect(sent).toHaveLength(0);
		expect(document.cookie).not.toMatch(/maschina_visitor/);
		savePreference("declined");
		start({ key: KEY, host: HOST });
		expect(sent).toHaveLength(0);
		expect(document.cookie).not.toMatch(/maschina_visitor/);
	});

	it("sends nothing where there is no key, even after accepting, so a missing setting never half works", () => {
		savePreference("accepted");
		start({ key: undefined, host: HOST });
		expect(sent).toHaveLength(0);
	});

	it("sends one page view to PostHog after accepting, with the page and a random visitor number, and sets one cookie", () => {
		savePreference("accepted");
		start({ key: KEY, host: HOST });
		expect(sent).toHaveLength(1);
		expect(sent[0]?.url).toBe(`${HOST}/i/v0/e/`);
		const body = sent[0]?.body as {
			api_key: string;
			event: string;
			distinct_id: string;
			properties: Record<string, unknown>;
		};
		expect(body.api_key).toBe(KEY);
		expect(body.event).toBe("$pageview");
		expect(body.distinct_id).toMatch(/^[0-9a-f-]{36}$/);
		expect(body.properties["$current_url"]).toBe(window.location.href);
		expect(body.properties["$pathname"]).toBe(window.location.pathname);
		// Only the page: nothing typed, no wallet, nothing about the person.
		expect(Object.keys(body.properties).sort()).toEqual(["$current_url", "$pathname", "$referrer"]);
		expect(document.cookie).toContain(`maschina_visitor=${body.distinct_id}`);
	});

	it("keeps the same visitor number from one visit to the next, so visits can be told apart from people", () => {
		savePreference("accepted");
		start({ key: KEY, host: HOST });
		start({ key: KEY, host: HOST });
		const ids = sent.map((entry) => (entry.body as { distinct_id: string }).distinct_id);
		expect(new Set(ids).size).toBe(1);
	});

	it("starts the moment the visitor accepts, and takes its cookie away the moment they decline", () => {
		start({ key: KEY, host: HOST });
		expect(sent).toHaveLength(0);
		savePreference("accepted");
		window.dispatchEvent(new Event("maschina:preference-changed"));
		expect(sent).toHaveLength(1);
		expect(document.cookie).toMatch(/maschina_visitor=/);
		savePreference("declined");
		window.dispatchEvent(new Event("maschina:preference-changed"));
		expect(document.cookie).not.toMatch(/maschina_visitor=/);
		expect(sent).toHaveLength(1);
	});

	it("is not fooled by the event that opens the toast: opening it changes nothing", () => {
		start({ key: KEY, host: HOST });
		window.dispatchEvent(new Event(OPEN_PREFERENCES));
		expect(sent).toHaveLength(0);
	});

	it("never breaks the page: a failed request is ignored", async () => {
		savePreference("accepted");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("offline");
			}),
		);
		expect(() => start({ key: KEY, host: HOST })).not.toThrow();
	});
});

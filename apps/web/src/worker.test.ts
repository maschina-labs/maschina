import { describe, expect, it, vi } from "vitest";
import { type Env, handle } from "./worker.ts";

const env = (fonts: Record<string, string> = {}): Env => ({
	ASSETS: { fetch: vi.fn(async () => new Response("the app")) },
	FONTS: {
		get: vi.fn(async (key: string) =>
			key in fonts
				? {
						body: new Response(fonts[key]).body as ReadableStream,
						httpMetadata: { contentType: "font/woff2" },
					}
				: null,
		),
	},
});

describe("the worker in front of the app", () => {
	it("serves a font from private storage, cached for a year", async () => {
		const res = await handle(
			new Request("https://maschina.dev/fonts/Sohne-400.woff2"),
			env({ "Sohne-400.woff2": "font" }),
		);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("font");
		expect(res.headers.get("cache-control")).toContain("immutable");
		expect(res.headers.get("content-type")).toBe("font/woff2");
	});

	it("serves everything else from the build", async () => {
		const fake = env();
		expect(await (await handle(new Request("https://maschina.dev/machines"), fake)).text()).toBe(
			"the app",
		);
		expect(fake.FONTS.get).not.toHaveBeenCalled();
	});

	it("looks up nothing that is not a plain font name, and says so when a font is missing", async () => {
		const fake = env();
		expect(
			(await handle(new Request("https://maschina.dev/fonts/%2E%2E%2Fsecret"), fake)).status,
		).toBe(404);
		expect((await handle(new Request("https://maschina.dev/fonts/notes.txt"), fake)).status).toBe(
			404,
		);
		expect((await handle(new Request("https://maschina.dev/fonts/Gone.woff2"), fake)).status).toBe(
			404,
		);
	});

	it("names the type of a font the bucket did not label", async () => {
		const fake = env();
		fake.FONTS.get = vi.fn(async () => ({ body: new Response("x").body as ReadableStream }));
		const res = await handle(new Request("https://maschina.dev/fonts/SohneBreit-600.otf"), fake);
		expect(res.headers.get("content-type")).toBe("font/otf");
	});
});

import { describe, expect, it } from "vitest";
import { handle } from "./worker.ts";

describe("the public record's old address", () => {
	it.each(["/", "/?machine=range", "/old-path?tab=paper"])(
		"permanently redirects %s to the website without losing its query",
		async (path) => {
			const source = new URL(path, "https://live.maschina.dev");
			const response = await handle(new Request(source));
			expect(response.status).toBe(308);
			expect(response.headers.get("location")).toBe(`https://maschina.dev/live${source.search}`);
		},
	);
});

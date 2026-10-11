import { describe, expect, it } from "vitest";
import { authUrlFrom } from "./auth-url.ts";

describe("where sign in and sign up lead", () => {
	it("is the app until the auth app exists, so no button leads to an address with nothing on it", () => {
		expect(authUrlFrom(undefined)).toBe("https://app.maschina.dev");
	});

	it("is whatever the build says when it says something, such as the auth app or a local one", () => {
		expect(authUrlFrom("https://auth.maschina.dev")).toBe("https://auth.maschina.dev");
		expect(authUrlFrom("http://localhost:3001")).toBe("http://localhost:3001");
	});

	it("treats an empty variable as not set", () => {
		expect(authUrlFrom("")).toBe("https://app.maschina.dev");
	});
});

import { describe, expect, it } from "vitest";
import { scopeViolation, withinScope, withinScopeOf } from "./scope.ts";

const SANDBOX = "/tmp/maschina-sandbox";

describe("withinScope", () => {
	it("accepts the scope root itself", () => {
		expect(withinScope(SANDBOX, SANDBOX)).toBe(true);
	});

	it("accepts a file directly inside", () => {
		expect(withinScope(SANDBOX, `${SANDBOX}/hello.txt`)).toBe(true);
	});

	it("accepts a file nested deeper", () => {
		expect(withinScope(SANDBOX, `${SANDBOX}/a/b/c/deep.txt`)).toBe(true);
	});

	it("refuses a sibling that shares the prefix as a string", () => {
		// The classic one. "/tmp/maschina-sandbox-evil".startsWith("/tmp/maschina-sandbox")
		// is true, and that directory is not inside the sandbox. The comparison
		// has to land on a separator.
		expect(withinScope(SANDBOX, "/tmp/maschina-sandbox-evil/steal.txt")).toBe(false);
		expect(withinScope(SANDBOX, "/tmp/maschina-sandboxer")).toBe(false);
	});

	it("refuses traversal out of the scope", () => {
		expect(withinScope(SANDBOX, `${SANDBOX}/../etc/passwd`)).toBe(false);
		expect(withinScope(SANDBOX, `${SANDBOX}/a/../../etc/passwd`)).toBe(false);
		expect(withinScope(SANDBOX, `${SANDBOX}/../../../../../../etc/shadow`)).toBe(false);
	});

	it("accepts traversal that stays inside", () => {
		// Going up and back down is fine as long as it lands inside.
		expect(withinScope(SANDBOX, `${SANDBOX}/a/../b.txt`)).toBe(true);
		expect(withinScope(SANDBOX, `${SANDBOX}/a/b/../../c.txt`)).toBe(true);
	});

	it("refuses a relative target", () => {
		// A relative path means something different depending on where the
		// process happens to be. Resolving it would be guessing.
		expect(withinScope(SANDBOX, "hello.txt")).toBe(false);
		expect(withinScope(SANDBOX, "../etc/passwd")).toBe(false);
		expect(withinScope(SANDBOX, "./inside.txt")).toBe(false);
	});

	it("refuses a relative scope", () => {
		expect(withinScope("sandbox", "/tmp/sandbox/x.txt")).toBe(false);
	});

	it("refuses an unrelated absolute path", () => {
		expect(withinScope(SANDBOX, "/etc/passwd")).toBe(false);
		expect(withinScope(SANDBOX, "/")).toBe(false);
		expect(withinScope(SANDBOX, "/tmp")).toBe(false);
	});

	it("tolerates a trailing separator on the scope", () => {
		expect(withinScope(`${SANDBOX}/`, `${SANDBOX}/hello.txt`)).toBe(true);
		expect(withinScope(`${SANDBOX}/`, "/tmp/maschina-sandbox-evil/x")).toBe(false);
	});

	it("normalises redundant separators and dots", () => {
		expect(withinScope(SANDBOX, `${SANDBOX}//a///b.txt`)).toBe(true);
		expect(withinScope(SANDBOX, `${SANDBOX}/./a/./b.txt`)).toBe(true);
	});

	it("is not fooled by the scope appearing later in the path", () => {
		expect(withinScope(SANDBOX, `/etc${SANDBOX}/passwd`)).toBe(false);
	});
});

describe("scopeViolation", () => {
	it("explains a path outside the scope with both resolved paths", () => {
		const message = scopeViolation(SANDBOX, `${SANDBOX}/../etc/passwd`);
		expect(message).toContain("/etc/passwd");
		expect(message).toContain(SANDBOX);
		expect(message).toContain("outside");
	});

	it("explains a relative target as a working-directory problem", () => {
		expect(scopeViolation(SANDBOX, "hello.txt")).toContain("working directory");
	});

	it("explains a relative scope", () => {
		expect(scopeViolation("sandbox", "/tmp/x")).toContain("not an absolute path");
	});
});

describe("withinScopeOf", () => {
	it("uses path containment for a filesystem", () => {
		expect(withinScopeOf("filesystem", "/sandbox", "/sandbox/a.txt")).toBe(true);
		expect(withinScopeOf("filesystem", "/sandbox", "/etc/passwd")).toBe(false);
	});

	it("carries the filesystem prefix trap through the dispatcher", () => {
		// The same attack as above, arriving by the other door. A dispatcher that
		// reimplemented the comparison instead of delegating would pass the direct
		// test and fail this one.
		expect(withinScopeOf("filesystem", "/sandbox", "/sandbox-evil/a.txt")).toBe(false);
	});

	it("uses equality for a model class", () => {
		expect(withinScopeOf("model", "fast", "fast")).toBe(true);
		expect(withinScopeOf("model", "fast", "reasoning")).toBe(false);
	});

	it("does not let a stronger class imply a weaker one", () => {
		// The widening path this exists to prevent. `reasoning` is the more
		// capable class, so it reads as though it should cover `fast`. Authority
		// nobody granted is authority nobody granted, whichever direction it
		// looks like it flows.
		expect(withinScopeOf("model", "reasoning", "fast")).toBe(false);
		expect(withinScopeOf("model", "long_context", "code")).toBe(false);
	});

	it("does not treat a model class as a path", () => {
		// A model scope is not a prefix. If this ever delegated to withinScope,
		// every model target would be refused for not being absolute, and the
		// failure would look like a permissions bug rather than a wiring bug.
		expect(withinScopeOf("model", "/fast", "/fast/anything")).toBe(false);
	});
});

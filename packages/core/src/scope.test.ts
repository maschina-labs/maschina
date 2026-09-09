import { describe, expect, it } from "vitest";
import { scopeViolation, scopeViolationOf, withinScope, withinScopeOf } from "./scope.ts";

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

	it("uses equality for a repository", () => {
		expect(withinScopeOf("repository", "maschina-labs/sandbox", "maschina-labs/sandbox")).toBe(
			true,
		);
		expect(withinScopeOf("repository", "maschina-labs/sandbox", "maschina-labs/maschina")).toBe(
			false,
		);
	});

	it("does not let a shared owner imply access to a sibling repository", () => {
		// The reason repository containment is equality and not a prefix. Two
		// repositories under one owner share an owner and nothing else that
		// matters, and a prefix rule would hand a sandbox capability the real one.
		expect(withinScopeOf("repository", "maschina-labs", "maschina-labs/maschina")).toBe(false);
		expect(
			withinScopeOf("repository", "maschina-labs/sandbox", "maschina-labs/sandbox-two"),
		).toBe(false);
	});

	it("uses equality for an objective", () => {
		expect(withinScopeOf("objective", "obj_1", "obj_1")).toBe(true);
		expect(withinScopeOf("objective", "obj_1", "obj_2")).toBe(false);
	});

	it("does not let authority to judge one objective reach another", () => {
		// Evaluation authority is per objective. A capability that judged whatever
		// it was pointed at would let one legitimate grant settle every objective
		// in the system.
		expect(withinScopeOf("objective", "obj_1", "obj_1_extra")).toBe(false);
		expect(withinScopeOf("objective", "obj", "obj_1")).toBe(false);
	});

	it("does not treat a model class as a path", () => {
		// A model scope is not a prefix. If this ever delegated to withinScope,
		// every model target would be refused for not being absolute, and the
		// failure would look like a permissions bug rather than a wiring bug.
		expect(withinScopeOf("model", "/fast", "/fast/anything")).toBe(false);
	});
});

describe("scopeViolationOf", () => {
	it("explains a filesystem refusal in the language of paths", () => {
		const said = scopeViolationOf("filesystem", "/sandbox", "/etc/passwd");
		expect(said).toContain("/etc/passwd");
		expect(said).toContain("/sandbox");
	});

	it("carries through the filesystem explanations that are not about containment", () => {
		expect(scopeViolationOf("filesystem", "sandbox", "/etc/passwd")).toContain(
			"not an absolute path",
		);
		expect(scopeViolationOf("filesystem", "/sandbox", "passwd")).toContain("working directory");
	});

	it("explains a model refusal in the language of model classes", () => {
		// The reason this exists. A model refusal phrased as "reasoning is not an
		// absolute path" reads as a wiring bug rather than as a denial, and a
		// denial nobody understands is a denial nobody acts on, which makes
		// recording it as prominently as a use pointless.
		const said = scopeViolationOf("model", "fast", "reasoning");
		expect(said).toContain("fast");
		expect(said).toContain("reasoning");
		expect(said).not.toContain("absolute path");
	});

	it("explains a repository refusal by naming both repositories", () => {
		expect(
			scopeViolationOf("repository", "maschina-labs/sandbox", "maschina-labs/maschina"),
		).toBe("this capability is for maschina-labs/sandbox, not maschina-labs/maschina");
	});

	it("explains an objective refusal by naming both objectives", () => {
		expect(scopeViolationOf("objective", "obj_1", "obj_2")).toBe(
			"this capability judges obj_1, not obj_2",
		);
	});

	it("names both the class held and the class asked for", () => {
		// Whoever reads this has to be able to tell which way round it went, so
		// they know whether to widen the grant or fix the caller.
		expect(scopeViolationOf("model", "code", "long_context")).toBe(
			"this capability is for the code model class, not long_context",
		);
	});
});

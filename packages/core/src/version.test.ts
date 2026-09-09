/**
 * How the version number moves.
 *
 * Here rather than beside the script, because `pnpm test` only collects tests
 * from inside the packages, and a test nobody runs is not a test. What it checks
 * is the release pipeline's arithmetic, imported from the script that does it.
 *
 * The thing being pinned down: **version components are integers, not decimal
 * places.** `0.9.0` becomes `0.10.0`. It is a reasonable thing to worry about,
 * because everything else written with dots between numbers does roll over, and
 * a version that silently reached `1.0.0` would announce a stability promise
 * nobody made.
 */

import { describe, expect, it } from "vitest";
// @ts-expect-error the release script is plain JavaScript with no type declarations
import { bumpFor, nextVersion } from "../../../.github/ci/next-version.mjs";

describe("nextVersion", () => {
	it("does not roll over at nine", () => {
		// The whole reason this file exists.
		expect(nextVersion("0.9.0", "minor")).toBe("0.10.0");
	});

	it("keeps going past ten, and past ninety-nine", () => {
		expect(nextVersion("0.10.0", "minor")).toBe("0.11.0");
		expect(nextVersion("0.99.0", "minor")).toBe("0.100.0");
	});

	it("never reaches 1.0.0 by arithmetic", () => {
		// Every bump a commit message can earn, from every version that looks
		// close to rolling over. None of them produce a major.
		for (const from of ["0.9.0", "0.9.9", "0.10.0", "0.99.99"]) {
			for (const bump of ["patch", "minor", "major"]) {
				expect(nextVersion(from, bump)).toMatch(/^0\./);
			}
		}
	});

	it("moves the minor for a breaking change while the major is zero", () => {
		// 0.x promises nothing, so there is no compatibility to break yet. This is
		// what the specification says 0.x means, not a local invention.
		expect(nextVersion("0.9.0", "major")).toBe("0.10.0");
	});

	it("moves the major once there is a promise to break", () => {
		expect(nextVersion("1.4.2", "major")).toBe("2.0.0");
	});

	it("resets the numbers to the right of whatever moved", () => {
		expect(nextVersion("1.4.2", "minor")).toBe("1.5.0");
		expect(nextVersion("1.4.2", "patch")).toBe("1.4.3");
	});
});

describe("bumpFor", () => {
	it("earns a minor for a feature", () => {
		expect(bumpFor(["feat(db): add a thing"])).toBe("minor");
	});

	it("earns a patch for a fix, a revert, or a dependency bump", () => {
		expect(bumpFor(["fix(cli): stop swallowing errors"])).toBe("patch");
		expect(bumpFor(["revert: that last one"])).toBe("patch");
		expect(bumpFor(["chore(deps): bump vitest"])).toBe("patch");
	});

	it("earns nothing for anything that cannot change behaviour", () => {
		// A version that moves without behaviour changing makes the number mean
		// less, and the number is the only summary most people read.
		expect(bumpFor(["docs: fix a typo", "ci: pin an action", "test: add a case"])).toBeNull();
		expect(bumpFor(["chore: tidy up"])).toBeNull();
	});

	it("takes the largest bump the batch earned, not the last one", () => {
		expect(bumpFor(["fix: a", "feat: b", "docs: c"])).toBe("minor");
	});

	it("treats a breaking marker as major, however it is written", () => {
		expect(bumpFor(["feat(db)!: change the shape"])).toBe("major");
		expect(bumpFor(["feat(db): change the shape\n\nBREAKING CHANGE: the shape"])).toBe("major");
	});

	it("ignores a subject that is not a conventional commit", () => {
		expect(bumpFor(["wip", "asdf", "Merge branch 'main'"])).toBeNull();
	});
});

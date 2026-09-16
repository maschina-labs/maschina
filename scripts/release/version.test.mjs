import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bump, bumpForMilestone, nextMilestoneVersion, parseVersion } from "./version.mjs";

describe("bump", () => {
	it("bumps each part and resets the ones below it", () => {
		assert.equal(bump("0.0.1", "patch"), "0.0.2");
		assert.equal(bump("0.3.12", "minor"), "0.4.0");
		assert.equal(bump("0.9.4", "major"), "1.0.0");
		assert.equal(bump("2.1.273", "patch"), "2.1.274");
		assert.equal(bump("2.1.273", "minor"), "2.2.0");
	});

	it("never rolls a part over into the next one", () => {
		assert.equal(bump("0.0.9", "patch"), "0.0.10");
		assert.equal(bump("0.9.0", "minor"), "0.10.0");
	});

	it("refuses anything that isn't a plain version", () => {
		for (const bad of ["1.0", "v1.0.0", "1.0.0-beta.1", "01.0.0", "", "x.y.z"]) {
			assert.throws(() => parseVersion(bad), /not a plain/);
		}
		assert.throws(() => bump("1.0.0", "huge"), /unknown bump/);
	});
});

describe("bumpForMilestone", () => {
	it("is a minor unless the description says major", () => {
		assert.equal(bumpForMilestone("A2: all trading machines"), "minor");
		assert.equal(bumpForMilestone(undefined), "minor");
		assert.equal(bumpForMilestone("Public launch.\n\nRelease: major"), "major");
		assert.equal(bumpForMilestone("release: MAJOR"), "major");
	});

	it("doesn't mistake a passing mention for the marker", () => {
		assert.equal(bumpForMilestone("Not a major release yet"), "minor");
		assert.equal(bumpForMilestone("Release: majority of screens"), "minor");
	});
});

describe("nextMilestoneVersion", () => {
	it("bumps from the current release", () => {
		assert.equal(nextMilestoneVersion("0.2.14", undefined, "minor"), "0.3.0");
		assert.equal(nextMilestoneVersion("0.9.3", "", "major"), "1.0.0");
	});

	it("keeps a queued release that is already at least as high", () => {
		assert.equal(nextMilestoneVersion("0.9.3", "1.0.0", "minor"), "1.0.0");
		assert.equal(nextMilestoneVersion("0.2.1", "0.3.0", "minor"), "0.3.0");
	});

	it("raises a queued release when the new milestone needs more", () => {
		assert.equal(nextMilestoneVersion("0.9.3", "0.10.0", "major"), "1.0.0");
	});
});

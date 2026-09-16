/**
 * Version math for releases.
 *
 * Every release bumps the patch. Closing a roadmap milestone bumps the minor, or the major when the
 * milestone's description says `Release: major`. The result is handed to release-please as the next
 * release, so nobody types a version or a tag.
 */

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const MAJOR_MARKER = /^\s*release:\s*major\s*$/im;

export function parseVersion(version) {
	const match = SEMVER.exec(String(version).trim());
	if (!match) throw new Error(`"${version}" is not a plain MAJOR.MINOR.PATCH version`);
	return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function formatVersion({ major, minor, patch }) {
	return `${major}.${minor}.${patch}`;
}

export function bump(version, kind) {
	const v = parseVersion(version);
	switch (kind) {
		case "major":
			return formatVersion({ major: v.major + 1, minor: 0, patch: 0 });
		case "minor":
			return formatVersion({ major: v.major, minor: v.minor + 1, patch: 0 });
		case "patch":
			return formatVersion({ major: v.major, minor: v.minor, patch: v.patch + 1 });
		default:
			throw new Error(`unknown bump "${kind}"`);
	}
}

/** A closed milestone bumps the minor unless its description marks it as a major release. */
export function bumpForMilestone(description) {
	return MAJOR_MARKER.test(description ?? "") ? "major" : "minor";
}

/**
 * The version the next release should be, given the current one and any release already queued.
 * A queued major is never downgraded by a later minor.
 */
export function nextMilestoneVersion(current, queued, kind) {
	const candidate = bump(current, kind);
	if (!queued) return candidate;
	return compare(parseVersion(queued), parseVersion(candidate)) >= 0 ? queued : candidate;
}

export function compare(a, b) {
	return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

#!/usr/bin/env node
/**
 * Does GitHub still agree with the repository?
 *
 * Drift is quiet. An issue tracker that disagrees with reality is the thing this
 * project exists to avoid: the previous implementation marked roughly sixty
 * capabilities built while its own logs showed nothing had ever run. The same
 * failure applies to a roadmap nobody prunes.
 *
 * Exits non-zero when it finds drift, so a scheduled job can act on it.
 *
 * Lives here rather than in internal/ because internal/ is gitignored, so a
 * workflow calling it there finds nothing. That cost four runs of a swallowed
 * MODULE_NOT_FOUND being blamed on a token, and one false drift report.
 *
 * Usage:  node .github/ci/check-tracker.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REPO = "maschina-labs/maschina";
const gh = (args) =>
	execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const manifest = readFileSync(new URL("./issues.jsonl", import.meta.url), "utf8")
	.split("\n")
	.filter((l) => l.trim())
	.map((l) => JSON.parse(l));

const issues = JSON.parse(
	gh([
		"issue",
		"list",
		"--repo",
		REPO,
		"--state",
		"all",
		"--limit",
		"500",
		"--json",
		"number,title,state,labels,milestone,updatedAt,body",
	]),
);
const milestones = JSON.parse(gh(["api", `repos/${REPO}/milestones?state=all&per_page=100`]));

const drift = [];
const note = (kind, detail) => drift.push({ kind, detail });

// 1. Everything in the manifest exists.
const titles = new Set(issues.map((i) => i.title));
for (const entry of manifest) {
	if (!titles.has(entry.title)) note("missing", `not on GitHub: ${entry.title}`);
}

// 2. Every open issue belongs to a milestone, so the roadmap has no orphans.
for (const issue of issues) {
	if (issue.state === "OPEN" && !issue.milestone) {
		note("no-milestone", `#${issue.number} ${issue.title}`);
	}
}

// 3. An empty body is an idea nobody else can act on.
for (const issue of issues) {
	if (issue.state === "OPEN" && (issue.body ?? "").trim().length < 40) {
		note("thin", `#${issue.number} ${issue.title}`);
	}
}

// 4. A milestone with everything closed is a milestone that should be closed.
for (const m of milestones) {
	if (m.state === "open" && m.open_issues === 0 && m.closed_issues > 0) {
		note("milestone-done", `${m.title}: ${m.closed_issues} closed, none open`);
	}
}

// 5. Blocked work that nobody has looked at. Gates are meant to be revisited,
//    and a gate nobody revisits is a plan that quietly stopped.
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
for (const issue of issues) {
	const blocked = issue.labels.some((l) => l.name === "blocked");
	if (
		issue.state === "OPEN" &&
		blocked &&
		Date.now() - Date.parse(issue.updatedAt) > NINETY_DAYS
	) {
		note("stale-gate", `#${issue.number} untouched for 90 days: ${issue.title}`);
	}
}

// 6. A merged pull request that closed nothing. The rule that every change
//    closes its issue existed for months with nothing enforcing it, and was
//    followed four times in forty pull requests. The result was 57 open issues
//    in one milestone, 22 of them describing work that had already shipped.
//    A check on the pull request itself blocks this now; this catches the
//    label bypass and anything merged around it.
const merged = JSON.parse(
	gh([
		"pr",
		"list",
		"--repo",
		REPO,
		"--state",
		"merged",
		"--limit",
		"30",
		"--json",
		"number,title,body,author",
	]),
);
const BOTS = new Set(["dependabot", "renovate", "github-actions"]);
for (const pr of merged) {
	if (BOTS.has(pr.author?.login?.replace(/\[bot\]$/, "") ?? "")) continue;
	if (!/(close[sd]?|fix(e[sd])?|resolve[sd]?) #\d+/i.test(pr.body ?? "")) {
		note("unlinked", `#${pr.number} ${pr.title}`);
	}
}

const byKind = {};
for (const d of drift) {
	byKind[d.kind] ??= [];
	byKind[d.kind].push(d.detail);
}

const EXPLAIN = {
	missing: "In the manifest, not on GitHub. Run sync-issues.mjs",
	"no-milestone": "Open with no milestone. Every open issue belongs to a stage",
	thin: "Body too short to act on. An issue nobody else can pick up is a note",
	"milestone-done": "Every issue closed. Close the milestone",
	"stale-gate": "A gate nobody has revisited. Decide, or say why not yet",
	unlinked: "Merged without closing an issue. The roadmap cannot show what shipped",
};

if (drift.length === 0) {
	console.log(`No drift. ${issues.length} issues, ${manifest.length} in the manifest.`);
	process.exit(0);
}

console.log(`${drift.length} thing(s) drifted.\n`);
for (const [kind, items] of Object.entries(byKind)) {
	console.log(`## ${kind}: ${EXPLAIN[kind]}`);
	for (const i of items) console.log(`  ${i}`);
	console.log("");
}
process.exit(1);

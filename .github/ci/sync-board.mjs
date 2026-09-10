#!/usr/bin/env node
/**
 * Put every issue on the board and give it a status.
 *
 * Status is derived, never typed by hand, so the board cannot drift from the
 * issues. Change a label or a milestone and run this again.
 *
 * Usage:
 *   node .github/ci/sync-board.mjs            every issue
 *   node .github/ci/sync-board.mjs --issue 64  just that one
 *   node .github/ci/sync-board.mjs --dry       say, do not do
 *
 * One issue at a time is what the issue-event trigger uses. Re-syncing all of
 * them because somebody added a label would be a few hundred API calls to change
 * one row, and would trip the rate limit the first time several issues moved at
 * once.
 */

import { execFileSync } from "node:child_process";

const REPO = "maschina-labs/maschina";
const PROJECT = "PVT_kwDOD-PwmM4BjBdL";
const STATUS_FIELD = "PVTSSF_lADOD-PwmM4BjBdLzhh3XU0";
const OPTION = {
	Next: "e843539f",
	"In progress": "77af8714",
	Blocked: "58530de9",
	Backlog: "9361c76c",
	Deferred: "842fc7c9",
	Done: "da74efef",
};
const DRY = process.argv.includes("--dry");
const ONLY = process.argv.includes("--issue")
	? Number(process.argv[process.argv.indexOf("--issue") + 1])
	: null;
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const gh = (args) =>
	execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const graphql = (query) => JSON.parse(gh(["api", "graphql", "-f", `query=${query}`]));

/** Where an issue belongs, from what it already says about itself. */
function statusFor(issue) {
	if (issue.state === "CLOSED") return "Done";
	const labels = issue.labels.map((l) => l.name);
	if (labels.includes("blocked")) return "Blocked";
	if (labels.includes("deferred")) return "Deferred";
	const milestone = issue.milestone?.title ?? "";
	if (/Stage [56]/.test(milestone)) return "Deferred";
	// The environment is the milestone in progress, so its work is next up.
	if (milestone === "The environment") return "Next";
	return "Backlog";
}

const FIELDS = "number,title,state,labels,milestone,url,id";
const issues = ONLY
	? [JSON.parse(gh(["issue", "view", String(ONLY), "--repo", REPO, "--json", FIELDS]))]
	: JSON.parse(
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
				FIELDS,
			]),
		);

// Everything already on the board, so this can be run repeatedly. For a single
// issue, ask GitHub which project items it belongs to rather than paging 194.
const onBoard = new Map();
if (ONLY) {
	const found =
		graphql(`query{repository(owner:"${REPO.split("/")[0]}",name:"${REPO.split("/")[1]}"){
		issue(number:${ONLY}){projectItems(first:10){nodes{id project{id}}}}}}`).data.repository.issue.projectItems.nodes.find(
			(n) => n.project.id === PROJECT,
		);
	if (found) onBoard.set(ONLY, found.id);
}
let cursor = null;
for (; !ONLY; ) {
	const after = cursor ? `, after: "${cursor}"` : "";
	const page = graphql(`query{node(id:"${PROJECT}"){... on ProjectV2{items(first:100${after}){
		pageInfo{hasNextPage endCursor}
		nodes{id content{... on Issue{number}}}}}}}`).data.node.items;
	for (const n of page.nodes) if (n.content?.number) onBoard.set(n.content.number, n.id);
	if (!page.pageInfo.hasNextPage) break;
	cursor = page.pageInfo.endCursor;
}

let added = 0;
let set = 0;
for (const issue of issues) {
	let itemId = onBoard.get(issue.number);
	if (!itemId) {
		if (DRY) {
			console.log(`would add #${issue.number}`);
			added++;
			continue;
		}
		itemId = graphql(
			`mutation{addProjectV2ItemById(input:{projectId:"${PROJECT}",contentId:"${issue.id}"}){item{id}}}`,
		).data.addProjectV2ItemById.item.id;
		added++;
		wait(700);
	}
	const status = statusFor(issue);
	if (DRY) {
		console.log(`#${issue.number}  ${status}  ${issue.title.slice(0, 60)}`);
		set++;
		continue;
	}
	graphql(
		`mutation{updateProjectV2ItemFieldValue(input:{projectId:"${PROJECT}",itemId:"${itemId}",fieldId:"${STATUS_FIELD}",value:{singleSelectOptionId:"${OPTION[status]}"}}){projectV2Item{id}}}`,
	);
	set++;
	wait(400);
}

console.log(`\n${added} added to the board, ${set} given a status.`);

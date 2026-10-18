#!/usr/bin/env node
/**
 * Every policy Turnkey holds, counted and named. Reads only: it creates, changes and deletes nothing.
 *
 * Turnkey will enforce 5 policies per organization. Each machine wallet currently gets two, so one
 * organization holds two machines, and nobody has yet listed what the real ones are against the real
 * machines. That is step one of `internal/DESIGN-TURNKEY-SUBORGS.md`, and this is it.
 *
 * It answers three questions:
 *
 *   - how many policies are there, against the limit
 *   - how many are the identical no-export DENY, which one organization-wide policy would replace
 *   - which belong to wallets that are test leftovers rather than machines
 *
 *   TURNKEY_ORGANIZATION_ID=... TURNKEY_API_PUBLIC_KEY=... TURNKEY_API_PRIVATE_KEY=... \
 *     node scripts/turnkey/policies.mjs
 *
 * The key may be the signer's; nothing here needs the admin key, because nothing here writes.
 */

import { TURNKEY_API, turnkeyApi } from "@maschina/wallet";

const need = (name) => {
	const value = process.env[name];
	if (!value) {
		console.error(`${name} is required. Nothing was read.`);
		process.exit(1);
	}
	return value;
};

const api = turnkeyApi({
	apiBaseUrl: process.env["TURNKEY_API_BASE_URL"] ?? TURNKEY_API,
	apiPublicKey: need("TURNKEY_API_PUBLIC_KEY"),
	apiPrivateKey: need("TURNKEY_API_PRIVATE_KEY"),
	organizationId: need("TURNKEY_ORGANIZATION_ID"),
});

const { policies } = await api.getPolicies();

/** `machine:<label>:sign` and `machine:<label>:no-export` are the two this system writes. */
const parse = (name) => {
	const match = /^machine:(.+):(sign|no-export)$/.exec(name);
	return match ? { label: match[1], kind: match[2] } : { label: null, kind: "other" };
};

const byLabel = new Map();
const other = [];
for (const policy of policies) {
	const { label, kind } = parse(policy.policyName);
	if (!label) {
		other.push(policy);
		continue;
	}
	const entry = byLabel.get(label) ?? { label, kinds: new Set(), policies: [] };
	entry.kinds.add(kind);
	entry.policies.push(policy);
	byLabel.set(label, entry);
}

// The no-export DENY names no wallet, so every copy of it is the same sentence. One organization
// wide policy replaces all of them, and covers wallets that do not exist yet as a bonus.
const noExport = policies.filter((p) => parse(p.policyName).kind === "no-export");
const conditions = new Set(noExport.map((p) => `${p.effect}|${p.consensus}|${p.condition}`));

console.log(`\n${policies.length} policies, against a coming limit of 5 per organization.\n`);

console.log(`  ${byLabel.size} wallets with machine policies`);
console.log(`  ${noExport.length} of them are the no-export DENY`);
console.log(
	conditions.size === 1
		? "  all identical, so one organization-wide DENY replaces every one of them"
		: `  ${conditions.size} DIFFERENT no-export conditions: look before consolidating`,
);
console.log(`  ${other.length} policies this system did not write\n`);

const labels = [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
for (const entry of labels) {
	const kinds = [...entry.kinds].sort().join(", ");
	// A wallet with only one of the two is half provisioned, which is worth seeing on its own.
	const odd = entry.kinds.size === 2 ? "" : "   <- incomplete";
	console.log(`  ${entry.label.padEnd(46)} ${kinds}${odd}`);
}

if (other.length > 0) {
	console.log("\nNot written by this system, so look before touching:");
	for (const policy of other) console.log(`  ${policy.policyName}  (${policy.effect})`);
}

const after = policies.length - noExport.length + (noExport.length > 0 ? 1 : 0);
console.log(`\nConsolidating the no-export DENY alone: ${policies.length} -> ${after}.`);
console.log("Still over 5, so sub-organizations remain the real fix. See the design.\n");

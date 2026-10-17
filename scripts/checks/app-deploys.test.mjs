/**
 * Every app that Cloudflare serves has something that deploys it.
 *
 * `live.maschina.dev` sat on an old build for hours on 2026-10-17 while its fix was merged and
 * green. Nothing deployed it: the other apps are connected to Cloudflare's own builds through the
 * dashboard, that one never was, and nothing in the repository said so. It only surfaced because
 * somebody loaded the page and found the old bundle (MISTAKES M50).
 *
 * So which apps ship, and how, is written down here and checked. An app added with a
 * `wrangler.jsonc` and no way to deploy it fails this, rather than being found by a person.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apps = fileURLToPath(new URL("../../apps/", import.meta.url));
const workflow = readFileSync(new URL("../../.github/workflows/apps.yml", import.meta.url), "utf8");

/**
 * Apps whose Worker is built by Cloudflare itself, from the dashboard's own repository connection,
 * so the workflow must leave them alone or every push would deploy each of them twice.
 *
 * This list is the only place that knowledge lives. Moving an app in or out of Cloudflare's builds
 * means editing it, and forgetting to is what this file catches.
 */
const BUILT_BY_CLOUDFLARE = ["app", "web"];

/**
 * Apps whose Worker does not exist yet, and whose pages are blank. Each one claims a custom domain
 * in its configuration, so deploying it would put an empty page on a live address. They join the
 * workflow when there is something on them worth serving, and this list is what makes that a
 * decision somebody takes rather than something nobody noticed.
 */
const NOT_BUILT_YET = ["auth", "docs"];

/** Every app with a Worker configuration, which is every app Cloudflare serves. */
const servedApps = readdirSync(apps, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.filter((app) => {
		try {
			readFileSync(new URL(`../../apps/${app}/wrangler.jsonc`, import.meta.url));
			return true;
		} catch {
			return false;
		}
	})
	.sort();

describe("every app Cloudflare serves gets deployed by something", () => {
	it("finds the apps that have a Worker at all", () => {
		// If this ever reads empty the rest of the file proves nothing, so it is asserted rather than
		// assumed.
		assert.ok(servedApps.length >= 4, `only found ${servedApps.join(", ")}`);
	});

	it("deploys each one the workflow is responsible for, by name", () => {
		for (const app of servedApps) {
			if (BUILT_BY_CLOUDFLARE.includes(app) || NOT_BUILT_YET.includes(app)) continue;
			assert.match(
				workflow,
				new RegExp(`apps/${app}/wrangler\\.jsonc`),
				`nothing deploys apps/${app}: add it to .github/workflows/apps.yml, or to BUILT_BY_CLOUDFLARE here if Cloudflare builds it`,
			);
		}
	});

	it("leaves the ones Cloudflare builds alone, so nothing deploys twice", () => {
		for (const app of BUILT_BY_CLOUDFLARE) {
			assert.doesNotMatch(
				workflow,
				new RegExp(`apps/${app}/wrangler\\.jsonc`),
				`apps/${app} is built by Cloudflare and by the workflow, so every push deploys it twice`,
			);
		}
	});

	it("never lists an app as both unbuilt and deployed", () => {
		for (const app of NOT_BUILT_YET) {
			assert.doesNotMatch(
				workflow,
				new RegExp(`apps/${app}/wrangler\\.jsonc`),
				`apps/${app} is listed as not built yet but the workflow deploys it: remove it from NOT_BUILT_YET`,
			);
		}
	});

	it("names only apps that exist, so a renamed app does not leave a stale exception", () => {
		for (const app of [...BUILT_BY_CLOUDFLARE, ...NOT_BUILT_YET]) {
			assert.ok(
				servedApps.includes(app),
				`${app} is listed as an exception but has no Worker configuration`,
			);
		}
	});

	it("reads the built bundle before deploying it, rather than trusting the build", () => {
		// A page built against localhost deploys fine, answers 200 and shows nothing, so the only
		// place to catch it is between the build and the deploy.
		const checked = workflow.indexOf("api\\.maschina\\.dev");
		const deployed = workflow.indexOf("wrangler deploy");
		assert.ok(checked > 0, "nothing reads the bundle before it goes out");
		assert.ok(checked < deployed, "the bundle has to be checked before it is deployed");
		assert.match(workflow, /localhost\|127/, "a localhost address has to fail the deploy");
	});

	it("builds with the API's address, never whatever a local .env happens to say", () => {
		// `vite.config.ts` reads env from the repository root, where .env is a developer's local file
		// pointing at localhost. A build that picks that up ships a page that calls localhost.
		assert.match(
			workflow,
			/VITE_GATEWAY_URL:\s*https:\/\/api\.maschina\.dev/,
			"the deploy has to set the gateway address explicitly",
		);
	});
});

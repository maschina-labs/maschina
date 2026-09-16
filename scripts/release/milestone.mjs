#!/usr/bin/env node
/**
 * Prints the version the next release should be after a milestone closes.
 * Used by .github/workflows/milestone.yml.
 *
 *   MILESTONE_DESCRIPTION="..." QUEUED_VERSION="" node scripts/release/milestone.mjs
 */

import { readFileSync } from "node:fs";
import { bumpForMilestone, nextMilestoneVersion } from "./version.mjs";

const manifest = JSON.parse(readFileSync(".release-please-manifest.json", "utf8"));
const current = manifest["."];
const kind = bumpForMilestone(process.env.MILESTONE_DESCRIPTION);
process.stdout.write(nextMilestoneVersion(current, process.env.QUEUED_VERSION, kind));

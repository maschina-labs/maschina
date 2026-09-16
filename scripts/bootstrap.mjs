#!/usr/bin/env node
/**
 * First run on a new machine: create .env, start Postgres, run migrations.
 * Safe to run again. It never overwrites an existing .env.
 */

import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const run = (command) => execSync(command, { stdio: "inherit" });

if (existsSync(".env")) {
	console.log(".env exists, leaving it alone.");
} else {
	copyFileSync(".env.example", ".env");
	console.log("Created .env from .env.example. Fill in the empty values you need.");
}

run("pnpm docker:up");
run("pnpm db:migrate");

console.log("\nReady. Run `pnpm check:machine` to check everything, then `pnpm dev`.");

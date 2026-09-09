import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Unit tests only: pure logic, no database, no filesystem, no network.
		// Anything needing a real Postgres is a proof and lives in test/*.proof.ts,
		// run by `pnpm proof`. Keeping the split means `pnpm test` stays fast
		// enough to run constantly, which is the only way tests actually get run.
		include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/out/**", "**/*.proof.ts"],
		reporters: ["default"],
	},
});

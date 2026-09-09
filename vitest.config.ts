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

		coverage: {
			provider: "v8",
			reporter: ["text-summary", "lcov"],

			// Only what unit tests can reach, which today is the pure core.
			//
			// packages/db is deliberately excluded. Its functions talk to Postgres
			// and are covered by the proofs, which run against a real database. A
			// unit-coverage number that counts them measures two different things
			// at once and falls every time real code is written, which trains
			// everyone to ignore it.
			//
			// `fold` in packages/db is the exception worth noting: it is pure and
			// it is unit tested, it just lives in a file that also holds database
			// code. Splitting the file to flatter a metric is the wrong trade.
			include: ["packages/core/src/**/*.ts"],
			exclude: ["**/*.test.ts", "**/index.ts", "**/*.d.ts"],

			// Set to what is actually true today, not to an aspiration. A threshold
			// above reality is a broken build; a threshold far below it lets
			// coverage rot silently. Raise these when they are comfortably beaten.
			thresholds: {
				statements: 95,
				branches: 80,
				functions: 100,
				lines: 95,
			},
		},
	},
});

import { vitestConfig } from "@maschina/config/vitest";
import { mergeConfig } from "vitest/config";

// Real Postgres, one fresh database per test file. Run with `pnpm test:integration`.
export default mergeConfig(vitestConfig({ include: ["test/**/*.test.ts"] }), {
	test: {
		testTimeout: 30_000,
		hookTimeout: 60_000,
		fileParallelism: false,
	},
});

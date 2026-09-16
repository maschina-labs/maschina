import { defineConfig, type ViteUserConfig } from "vitest/config";

type Options = {
	environment?: "node" | "jsdom";
	setupFiles?: string[];
	/** Minimum coverage, as a percentage. Pure packages hold a higher bar. */
	coverage?: number;
	/** Files covered by another suite, such as integration tests, rather than unit tests. */
	coverageExclude?: string[];
	/** Test file patterns, when a workspace keeps tests somewhere other than src and test. */
	include?: string[];
};

/** The one Vitest setup every workspace uses, so tests behave the same everywhere. */
export function vitestConfig({
	environment = "node",
	setupFiles = [],
	coverage = 80,
	coverageExclude = [],
	include = ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
}: Options = {}): ViteUserConfig {
	return defineConfig({
		test: {
			environment,
			setupFiles,
			include,
			exclude: ["**/node_modules/**", "**/dist/**"],
			restoreMocks: true,
			unstubEnvs: true,
			unstubGlobals: true,
			passWithNoTests: false,
			coverage: {
				provider: "v8",
				include: ["src/**/*.{ts,tsx}"],
				exclude: ["src/**/*.test.{ts,tsx}", "src/**/index.ts", "src/**/*.d.ts", ...coverageExclude],
				thresholds: {
					lines: coverage,
					functions: coverage,
					branches: coverage,
					statements: coverage,
				},
			},
		},
	});
}

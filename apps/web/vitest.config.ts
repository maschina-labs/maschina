import { vitestConfig } from "@maschina/config/vitest";
import react from "@vitejs/plugin-react";
import { mergeConfig } from "vitest/config";

export default mergeConfig(
	vitestConfig({
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
		// Generated and entry files; what they wire together is tested directly. The screens under
		// routes/ are excluded while the app's design is being worked out: they are composition over
		// lib/, which is held to the full bar, and they are checked by opening them. Covering them with
		// unit tests is in TECH_DEBT.md, to be done with browser tests once the design settles.
		coverageExclude: [
			"src/main.tsx",
			"src/routeTree.gen.ts",
			"src/lib/errors.ts",
			"src/lib/env.ts",
			"src/routes/**",
		],
	}),
	{ plugins: [react()] },
);

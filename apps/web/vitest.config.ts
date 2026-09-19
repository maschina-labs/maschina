import { vitestConfig } from "@maschina/config/vitest";
import react from "@vitejs/plugin-react";
import { mergeConfig } from "vitest/config";

export default mergeConfig(
	vitestConfig({
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
		// Generated and entry files; what they wire together is tested directly.
		coverageExclude: ["src/main.tsx", "src/routeTree.gen.ts", "src/lib/errors.ts"],
		// Rendering the whole app in jsdom is slow on a busy machine, and a timeout there says nothing about
		// the page.
		testTimeoutMs: 20_000,
	}),
	{ plugins: [react()] },
);

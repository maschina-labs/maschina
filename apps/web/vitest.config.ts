import { vitestConfig } from "@maschina/config/vitest";
import react from "@vitejs/plugin-react";
import { mergeConfig } from "vitest/config";

export default mergeConfig(
	vitestConfig({
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
		// Generated and entry files; what they wire together is tested directly.
		coverageExclude: ["src/main.tsx", "src/routeTree.gen.ts", "src/lib/errors.ts"],
	}),
	{ plugins: [react()] },
);

import { vitestConfig } from "@maschina/config/vitest";
import react from "@vitejs/plugin-react";
import { mergeConfig } from "vitest/config";

export default mergeConfig(
	vitestConfig({
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
		// The entry only mounts the page, which is tested directly. The sample data is for the dev server only and is
		// never in a build.
		coverageExclude: ["src/main.tsx", "src/dev/**"],
	}),
	{ plugins: [react()] },
);

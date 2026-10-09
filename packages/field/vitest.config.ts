import { vitestConfig } from "@maschina/config/vitest";
import react from "@vitejs/plugin-react";
import { mergeConfig } from "vitest/config";

export default mergeConfig(
	vitestConfig({
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
		// GPU drawing: the fog shader and the towers. A test browser has no WebGL to draw them with; they
		// are checked by rendering them in a real browser (TECH_DEBT.md).
		coverageExclude: ["src/fog-background.tsx", "src/towers-scene.tsx"],
	}),
	{ plugins: [react()] },
);

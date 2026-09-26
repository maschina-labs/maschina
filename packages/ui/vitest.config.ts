import { vitestConfig } from "@maschina/config/vitest";

// shadcn and beautifui are vendored: their code is copied in, not written here, and it is covered by
// the screens that use it rather than by tests of its own. Everything we write in this package is held
// to the usual bar.
export default vitestConfig({
	environment: "jsdom",
	setupFiles: ["./vitest.setup.ts"],
	coverageExclude: ["src/shadcn/**", "src/beautifui/**"],
});

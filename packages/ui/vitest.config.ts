import { vitestConfig } from "@maschina/config/vitest";

export default vitestConfig({ environment: "jsdom", setupFiles: ["./vitest.setup.ts"] });

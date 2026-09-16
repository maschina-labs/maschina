import { vitestConfig } from "@maschina/config/vitest";

// main.ts and api/index.ts only wire real dependencies together; everything they call is tested.
export default vitestConfig({ coverageExclude: ["src/main.ts"] });

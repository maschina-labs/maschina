import { vitestConfig } from "@maschina/config/vitest";

// main.ts, api/index.ts and deps.ts only wire real dependencies together. What they call is tested:
// the routes, the shapes they return, the session and the provisioner client all have their own files.
export default vitestConfig({ coverageExclude: ["src/main.ts", "src/deps.ts"] });

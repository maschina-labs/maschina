import { vitestConfig } from "@maschina/config/vitest";

// main.ts only wires real dependencies together; everything it calls is tested.
export default vitestConfig({ coverageExclude: ["src/main.ts"] });

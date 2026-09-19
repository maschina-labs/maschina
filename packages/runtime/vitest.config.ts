import { vitestConfig } from "@maschina/config/vitest";

// The property tests here check thousands of cases each, and need room on a busy machine.
export default vitestConfig({ coverage: 95, testTimeoutMs: 30_000 });

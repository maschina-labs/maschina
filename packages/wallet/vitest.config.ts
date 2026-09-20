import { vitestConfig } from "@maschina/config/vitest";

// The bar this code was already held to in the signer. What sits below it is the provider's error
// handling, which is covered against the real provider by the check script rather than here.
export default vitestConfig({ coverage: 82 });

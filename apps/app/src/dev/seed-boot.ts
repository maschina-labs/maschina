// Loaded by the dev server only, before the app, so made-up data is in place before its first request.
import { config } from "../lib/env.ts";
import { installSeed, seedRequested } from "./seed.ts";

if (seedRequested()) installSeed(config.VITE_GATEWAY_URL);

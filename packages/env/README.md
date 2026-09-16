# @maschina/env

Loads and validates environment variables, once, at startup.

```ts
import { env, loadEnv } from "@maschina/env";

export const config = loadEnv({
	PORT: env.port(4000),
	DATABASE_URL: env.postgresUrl(),
});
```

A service with a missing or malformed variable refuses to start, and the error names every problem.

**Owns:** reading configuration. `@maschina/env/client` is the browser version, and only accepts
public `VITE_` variables.

**Never:** prints a value, since values are often secrets. Never lets a secret-looking variable into a
browser bundle.

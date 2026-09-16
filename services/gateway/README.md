# @maschina/gateway

The public API. The web app, the bots and, later, developers all come through here.

- Versioned under `/v1`, with the OpenAPI document at `/openapi.json`.
- Routes are defined with `@hono/zod-openapi`, so validation and documentation come from the same
  schema in `@maschina/contracts`.
- The web app imports only the gateway's **types** (`import type { AppType }`) and gets a fully typed
  client with no generated code.
- CORS allows only configured origins. Every client is rate limited.

```bash
pnpm gateway      # port 4000
```

Deploys to Vercel through `api/index.ts`.

**Owns:** the public contract.

**Never:** signs, holds wallet credentials, or trusts a request because of where it claims to come
from.

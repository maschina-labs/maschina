# infra

Reserved. Production does not deploy from this folder today.

**How production actually runs**, so nobody goes looking here for it:

| Part | Where it is | Defined in |
| --- | --- | --- |
| The six services | Docker on the VPS, behind a Cloudflare tunnel, no ports open | `docker/compose.prod.yml` |
| Postgres | A named volume on the same box | `docker/compose.prod.yml`, `docker/postgres/` |
| Server setup, updates, backups | Shell, run on the box | `scripts/server/` |
| Deploy | On merge to main, by release | `.github/workflows/` |
| The web apps | Cloudflare Workers, one per app | each app's `wrangler.jsonc` |

What would live here if the deployment outgrows a single compose file: per-environment configuration,
reverse proxy and TLS beyond the tunnel, scheduled jobs, and notes on how each environment is built.

Until then this folder is empty on purpose, and `docker/` plus `scripts/server/` are the real answer.

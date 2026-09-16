# @maschina/integration-tests

Tests that run against a real Postgres, never a mock. Each test file gets its own fresh, migrated
database, dropped afterwards.

```bash
pnpm docker:up
pnpm test:integration
```

**Owns:** proving that the pieces work together against real infrastructure.

**Never:** runs against the development database, or passes without Docker.

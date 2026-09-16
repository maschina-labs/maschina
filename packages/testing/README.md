# @maschina/testing

Test helpers shared by every package.

- `createTestDatabase()` makes a fresh, migrated Postgres database for one test run and drops it
  afterwards. Needs `pnpm docker:up`.
- `units()`, `testClock()` and `testId()` keep tests short and consistent.

**Owns:** test setup.

**Never:** imported by production code.

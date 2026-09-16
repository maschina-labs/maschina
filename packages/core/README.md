# @maschina/core

The shared vocabulary every other package speaks: identifiers, errors, results, time and money.

**Owns:** types and pure functions that everything else depends on.

**Never:** I/O of any kind. No database, no network, no filesystem, no environment variables.
`pnpm check:boundaries` fails the build if that changes.

| Module | What it is |
| --- | --- |
| `money` | Token amounts as integers in base units. Never floating point |
| `id` | Time-ordered identifiers, typed by what they identify |
| `errors` | One error type with a stable code |
| `result` | `Result<T, E>` for code that should not throw |
| `clock` | Time as a dependency, so schedules and leases can be tested |

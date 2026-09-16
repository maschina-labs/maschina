# checks

Rules that fail the build instead of relying on memory.

| Script | Checks |
| --- | --- |
| `boundaries.mjs` | Architecture boundaries: who may import Solana, wallet SDKs, the database, or side effects |
| `bundle-deps.mjs` | A built service declares every npm package its bundle imports. The unused-code check can't see bundling, so it is told to skip exactly these |
| `licenses.mjs` | Every production dependency has an approved licence |

Each has tests alongside it, written to fail first.

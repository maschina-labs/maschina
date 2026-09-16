# scripts

Repository tooling. Plain Node, no dependencies, each with tests alongside it.

| Script | What it does |
| --- | --- |
| `bootstrap.mjs` | `pnpm bootstrap`: sets up a fresh clone |
| `check-machine.mjs` | `pnpm check:machine`: checks the tools this repo needs are installed |
| `new-package.mjs` | `pnpm new:package`: creates a package or service with the standard layout |
| `checks/` | Rules that fail the build: architecture boundaries, bundled dependencies, licences |
| `ci/changes.mjs` | Decides which CI jobs a change needs. Tests alongside it also guard the Dependabot config |
| `git/stack.mjs` | `pnpm stack` and `pnpm restack`: stacked branches that survive squash merges, and the branch name rule |
| `release/` | Version math for milestone releases |

Run every script test with `pnpm test:scripts`.

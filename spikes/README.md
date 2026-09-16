# spikes

Throwaway experiments that answer one question each, such as whether a wallet provider enforces
a policy the way it claims to.

- A spike is not part of the workspace, and nothing outside this folder may import from it.
- Each spike has its own folder, its own `package.json`, and a `FINDINGS.md` that records the
  answer.
- Each spike is its own install, with its own `pnpm-workspace.yaml` (the same safety settings as the
  main one) and its own lockfile, so a spike's dependencies never reach Maschina's.
- Each spike has `test` and `typecheck` scripts. `pnpm test:spikes` runs them for every spike, and CI
  runs it too.
- When the question is answered, the finding moves into the real code or docs and the spike is
  deleted.

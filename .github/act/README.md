# Local CI

`pnpm ci:local` runs the pull request workflows on this machine with [act](https://github.com/nektos/act),
so problems show up before anything is pushed. `.actrc` holds the runner image and settings, and
`pull_request.json` is the event the workflows see.

```bash
pnpm ci:local             # CI and pull request checks, as a pull request would run them
pnpm ci:local:ci          # CI only
pnpm ci:local:pr          # pull request checks only
```

Workflows that need GitHub itself (release, milestone, images, CodeQL, Scorecard, label sync) only run
there.

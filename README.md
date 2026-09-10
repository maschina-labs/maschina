# Maschina

An operating system for delegated work.

Maschina takes an objective from a human, assigns it to a durable worker, grants
that worker bounded authority over real resources, runs it on a real machine, and
keeps a permanent record of what happened and why.

## Status

**Stage 0. Early, and honest about it.**

Nothing here is finished. The architecture is written and the foundation is being
built one slice at a time, where a slice is done when its proof runs, not when the
code looks right. Right now that means an append-only event log in Postgres, a
CLI that writes to it, and a desktop shell that does not read from it yet.

If you are looking for something to use, this is not that yet.

## The idea

Most AI systems today live inside a chat session. A chat session is
request-scoped, dies when the window closes, and has no authority of its own. So
anything it does in the real world either goes through a human copying output
around, or through a script running with unbounded credentials, because
credentials do not come in the shape we need. An API key has no concept of *this
worker may spend twenty dollars, write to this one repository, and nothing else*.

The result is that the human becomes the runtime: the scheduler, the memory, the
integration layer, the error handler, the authority system.

Maschina is the layer that should be doing that instead. Three properties define
it:

**Durable.** Work outlives the conversation that created it, the process that
started it, and the machine that was running it. A worker that is interrupted
resumes.

**Bounded.** A worker acts only through authority explicitly granted to it. There
is no ambient permission. What it may touch, spend, and change is a finite set,
enforced by the system rather than requested in a prompt.

**Real.** It runs on real machines against real repositories and real services.
Simulation is a testing mode, never the product.

The bet underneath all of it: autonomy is a property of the system a model runs
inside, not a property of the model.

## Layout

```
apps/desktop        the working environment. Electron, React, Vite
packages/core       the six primitives
packages/db         the event log. Postgres, append-only
packages/cli        the maschina CLI
services/           long-running processes. The control plane lands here
docker/             local Postgres, and nothing else
```

## Running it

Needs Node 22+, pnpm, and Docker.

```bash
pnpm install
pnpm db:up                  # Postgres, nothing else
pnpm maschina db init       # create the log

pnpm maschina event append --actor human:you --type note.recorded --payload '{"text":"hello"}'
pnpm maschina log           # read the stream back

pnpm proof                  # prove the log is actually append-only
pnpm desktop                # open the working environment
```

`pnpm proof` is the interesting one. It appends events, reads them back in order,
then tries six different ways to mutate or forge the log and confirms every one is
rejected, by the database rather than by the application.

## Development

```bash
pnpm check        # biome, plus the repo's own rules
pnpm typecheck    # every package
pnpm test         # unit tests
pnpm proof        # proofs, which need a real Postgres
pnpm ci:local     # run the GitHub Actions workflows locally with act
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
There is a pre-commit hook; do not skip it.

## Why the record matters

Every effect the system has on the world is written down before it is attempted,
and the outcome is written down after. The event log is the only durable state in
the system. Everything else, including what a worker knows and what an objective
costs, is a projection over that log and can be deleted and rebuilt at any time.

That is why the log is append-only at the database level, with two independent
mechanisms, and why breaking it is a schema change rather than an accident.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues go to
[SECURITY.md](SECURITY.md), not the issue tracker.

## Licence

**Proprietary. All rights reserved.** See [LICENSE](LICENSE).

This repository is public because CI is free on public repositories. That is the
only reason. No rights are granted, and the licensing is deliberately undecided
for now.

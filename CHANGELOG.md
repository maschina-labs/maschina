# Changelog

Everything notable that changes in Maschina gets written down here.

Maschina is pre-release. Until there is a real release process, entries are
written by hand, in plain language, so that someone who did not write the code can
tell what changed.

## [Unreleased]

### Added

- **The event log.** An append-only `events` table in Postgres, with a CLI that
  writes to it and reads it back in order. This is the only durable state in the
  system; everything else is a projection over it and can be rebuilt.
- **Append-only is enforced by the database, not by the code.** The application
  role holds `SELECT` and a column-level `INSERT` and nothing else, and triggers
  reject `UPDATE`, `DELETE` and `TRUNCATE` for every role including the owner.
  Two independent mechanisms, so removing the guarantee is a deliberate schema
  change rather than an accident.
- **A proof that the log holds.** `pnpm proof` appends events, reads them back,
  then tries six ways to mutate or forge the log and confirms every one is
  rejected. It also fails if a mutation path ever appears in the source.
- **The working environment shell.** An Electron window with the security posture
  set from the first commit: context isolation on, no Node in the renderer,
  sandboxed, and a preload bridge that currently exposes one read-only value.
- **Monorepo layout.** pnpm workspaces and Turborepo, with the CLI, the log, the
  primitives, and the desktop app split into packages so shared code is written
  once.
- **Continuous integration.** Every push and pull request runs formatting, lint,
  typecheck, tests, and the proofs against a real Postgres. Separate workflows
  scan for leaked secrets and run CodeQL. Workflows can be run locally with act,
  so a broken pipeline does not need a push to find.
- **Checks that enforce the house rules rather than trusting anyone to remember
  them.** Pull request titles must be conventional commits, every pull request
  must update this changelog unless it is explicitly labelled otherwise, and no
  em dash may appear anywhere in the repository.
- **The documents GitHub actually surfaces.** README, contributing guide, security
  policy, code of conduct, support, issue templates for bugs, features and design
  problems, a pull request template, code owners, and dependabot.

### Fixed

- **Event ids could be forged.** `GENERATED ALWAYS AS IDENTITY` is not enough on
  its own: any role holding table-level `INSERT` can override it with
  `OVERRIDING SYSTEM VALUE`. Granting `INSERT` per column, with `id` and
  `recorded_at` left out, is what actually closes it.
- **The desktop preload bridge silently did not load.** A sandboxed preload has
  to be CommonJS, and the build was emitting an ES module. The window rendered
  perfectly and every call across the bridge would have quietly returned nothing.

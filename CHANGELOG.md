# Changelog

Everything notable that changes in Maschina gets written down here.

Entries are written by hand, in plain language, so that someone who did not write
the code can tell what changed. They are not generated from commit subjects: a
changelog assembled from commit subjects reads like a commit log, which is the
thing a changelog exists to save you from reading.

Versions follow semver, and the minor number is the count of Stage 0 slices whose
proof passes, so the version says where the project actually is. `1.0.0` means all
ten proof criteria hold. See `internal/operations/RELEASING.md`.

## [Unreleased]

### Added

- **Capabilities, and the first real effect.** Maschina can now write a file, and
  only where it was told it may. Authority is a held object with an enumerated
  list of operations and a path it is confined to, not a permission looked up
  from an identity. Every use is checked against the log at the moment it
  happens and never cached, so revoking a capability stops the next action rather
  than eventually.
- **Nothing reaches the world unrecorded.** An effect is authorised, then written
  down, then performed, then its outcome is written down. If the process dies
  after the write-ahead point the log says what was about to happen and the
  recovery path can tell what to do about it. Proven with an actual `kill -9`
  between the two records.
- **Refusals are as visible as successes.** A worker writing outside its path, or
  attempting an operation it was never granted, produces a recorded denial saying
  who tried, what they tried, and why it was refused. A denied action produces no
  intent at all, because it never became an attempt.

### Fixed

- **A revoked capability could be brought back to life.** Appending a grant for an
  already-revoked capability reactivated it, and since the log is append-only that
  made revocation a suggestion rather than a control. Revocation is now terminal;
  re-granting means a new capability. Found by writing the test for it.

### Added

- **Event payloads carry a version.** The log is append-only, so an event written
  in the wrong shape is written in the wrong shape permanently. Every payload now
  carries `v`, readers handle every version they have ever seen, and a reader that
  meets a version from the future stops rather than folding a partial answer.
  Decided at eight events rather than eight million (`ADR-006`).
- **Supply chain hardening.** Every GitHub Action is pinned to an immutable commit
  SHA rather than a mutable tag, so a compromised tag cannot run with the
  repository's token. OpenSSF Scorecard runs weekly, dependency review blocks a
  pull request that introduces a known vulnerability or a copyleft licence, an
  SBOM is produced on every push to main, and releases carry signed build
  provenance that can be verified with `gh attestation verify`.
- **Coverage, with a floor set to reality.** 96% of the pure core, enforced in CI.
  The database packages are deliberately outside the number: they are covered by
  proofs against a real Postgres, and mixing the two produces a figure that falls
  every time real code is written.

### Added

- **Objectives, and a contract that cannot move.** You state an objective with a
  completion contract saying what would count as done. If the contract holds it
  is admitted and hashed; if it does not, the objective is rejected and the
  reasons are recorded. A contract cannot say "make the code better": every
  criterion has to say how it gets checked and how strongly, and self-assessment
  is not an option the contract can ask for.
- **The frozen contract is enforced, not requested.** Trying to change the
  contract of an admitted objective is refused, and the attempt is written to the
  log along with both the frozen hash and the hash of whatever someone wanted
  instead. There is no force flag. Changing a contract creates a new objective.
- **Tests.** 27 unit tests covering contract validation, canonical hashing, and
  the objective projection, plus a slice proof with 27 checks against a real
  Postgres. `pnpm test` is pure and fast so it can run constantly; `pnpm proof`
  needs the database and is never cached, because a cached proof reports a pass
  for a run that did not happen.

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
- **CI was red on the first commit.** Three separate causes: a lint error hidden
  among warnings, two em dashes that the repo's own check correctly rejected, and
  pinned action versions that were two majors out of date. The em dash check also
  failed on itself, since the pattern it searches for was written literally in the
  file doing the searching.
- **Dependency bumps no longer fight the changelog rule.** Bots are exempt from
  the changelog check, because "typescript 5.9.3 to 5.9.4" is not something a
  changelog reader cares about, and requiring an entry would train us to skip the
  check. Dependabot is also grouped weekly instead of opening one pull request per
  package, and majors on the pinned toolchain are held back for review.
- **The desktop preload bridge silently did not load.** A sandboxed preload has
  to be CommonJS, and the build was emitting an ES module. The window rendered
  perfectly and every call across the bridge would have quietly returned nothing.

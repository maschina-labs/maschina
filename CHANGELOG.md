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

- **A release can be re-cut without an empty commit.** The version workflow only
  ran on a merge, so a release that failed, or one whose setup landed after the
  last merge, had nothing to trigger it. It can now be started by hand.

### Fixed

- **The release pull request could pass every check and still not merge.** The
  bot committed with git, which signs nothing, and main requires signed commits.
  The release commit is now created through GitHub's API, which signs it. The
  other fix available was dropping the signature requirement, which trades a
  permanent weakening of every commit on main against a bot that cannot sign.
- **The tag would have appeared with nothing listening.** It was pushed with the
  built in token, and a push made with that token starts no workflows, so the
  release workflow watching for the tag would never have run.

### Added

- **A release can be re-cut without an empty commit.** The version workflow only
  ran on a merge, so a release that failed, or one whose setup landed after the
  last merge, had nothing to trigger it. It can now be started by hand.

### Fixed

- **Releases could not be published at all.** The provenance step fed the git
  commit sha into a field wanting a sha256 digest, so the first tag ever pushed
  failed on it. A git sha names a tree and is not the digest of anything anyone
  downloads. Releases now build a source archive, attest that, and attach it, so
  the attestation is about an artifact that exists.
- **The version workflow tried to push to a protected branch.** It now opens a
  release pull request instead, which goes through the same checks as every other
  change. The first design gave the bot a bypass on the ruleset; GitHub refused
  it, and was right to.

## [0.4.0] - 2026-09-09

### Added

- **Versions cut themselves.** Merging to main reads the commits since the last
  tag, works out what they earned, rolls the changelog, bumps the version, commits
  and tags. A `feat` is a minor, a fix or a dependency bump is a patch, and
  anything that cannot change behaviour is no release at all. The scheme existed
  since the first commit and had produced zero tags and zero releases, with the
  version claiming to be two slices behind where the code was. A release step
  that only runs when someone remembers is a release step that does not run.
- **The linter now fails on an unused import instead of shrugging.** Biome's
  recommended preset reports one as a warning, so `pnpm check` printed the
  diagnostic and still exited zero. CodeQL caught one that our own build had
  passed. In a proof a dead import usually means a dead assertion, which is what
  it meant this time, so `noUnusedImports` and `noUnusedVariables` are errors.
- **The outage proof asserts the error type, not the wording.** It matched on a
  phrase in the message, which would have passed for any error containing that
  phrase and failed the day someone reworded it. It now requires a
  `ControlPlaneUnreachable`.
- **The node is separated from the control plane, over HTTP.** The event log, the
  authority check and the secrets live in one process, and the worker lives in
  another. The worker talks to it through a two method port and has no database
  driver at all. CI fails the build if the worker or the desktop app so much as
  mentions `pg` or the database package, in source or in a manifest, so the
  boundary is checked rather than remembered. `06-NODES` open question 1 warns
  about a system that only ever works colocated and discovers at Stage 2 that the
  separation was never real. It cannot happen if the node has no other option.
- **A node that cannot reach the control plane stops.** It does not proceed
  unsupervised, it does not queue work to reconcile later, and it does not write
  anything to disk. It says which call failed and why, and nothing is recorded,
  because nothing could be. That is `06-NODES` open question 4 answered in the
  shape of the code rather than in a policy document.
- **The control plane is a real service.** A Hono app serving the log, the
  capability list, the authority decision and revocation. Event ids and epochs are
  bigints, and JSON has no bigint, so they travel as strings rather than losing
  precision silently above 2^53.
- **`pnpm dev` starts everything.** Postgres, the control plane and the desktop
  app together, so the application can actually be run without knowing the order.
  `pnpm gate` runs the whole gate, and `pnpm fix:electron` repairs the duplicate
  Electron copy pnpm's store occasionally leaves behind.


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

- **A worker could be tricked out of its sandbox with a symlink.** The path check
  is pure string comparison, so a link sitting inside the allowed directory
  passes it while pointing anywhere on disk. Writes now refuse to follow a
  symlink at the target, and the refusal says so in the log rather than looking
  like a disk error. Found by CodeQL, which flagged the write as an insecure
  temporary file, and it was right.
- **Files a worker writes are no longer world readable.** They are created owner
  read and write only, rather than inheriting whatever the umask happened to be
  in a shared directory.
- **A revoked capability could be brought back to life.** Appending a grant for an
  already-revoked capability reactivated it, and since the log is append-only that
  made revocation a suggestion rather than a control. Revocation is now terminal;
  re-granting means a new capability. Found by writing the test for it.


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

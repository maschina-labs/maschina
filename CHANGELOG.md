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

- **The whole system can be rebuilt from the log alone.** The database was
  destroyed entirely, the log put back, and every capability, objective,
  workspace and verdict came back identical, with every causal link still
  pointing at an event that exists. That is the bet the architecture rests on,
  now demonstrated rather than believed.
- **Restoring the log is an operator action, and it works.** The application can
  never write an event's id or timestamp, which is what makes the order of
  history unforgeable, and the same rule means it cannot restore a backup either.
  There is now a restore path for the role that can, and it keeps ids intact,
  because renumbering would repoint every causal link while leaving the log
  looking valid.
- **Approval actually stops things now.** A capability that says a human must
  approve a use is refused until one does, the request is recorded so there is
  something to answer, and an approval covering a single use is spent once.
- **Delegation cannot widen.** Authority passed on must be shallower than what it
  came from, and something with nothing left to pass on cannot pass anything on.

### Fixed

- **A field that read like a control and was not one.** Every capability declared
  whether a human had to approve its use, and nothing ever looked. Nine checks
  ran on every action and that was not one of them, including on the capability
  that stops the whole system.
- **Judging was not going through the same path as every other action.** A
  verdict was written straight to the database, so it had no record of being
  intended, the authority to judge was never actually exercised, and a worker on
  another machine could not have recorded one at all.
- **Deciding to judge disqualified the judge.** Found while fixing the above: a
  worker records what it decided before it is allowed to act, so the act of
  deciding to judge counted as having worked on the thing being judged.
- **Events were trusted to be the right shape.** The version number was checked
  and the shape was assumed, so a malformed record became a capability that
  refused everything without ever saying why.
- **Changing which model answers meant changing code.** The mapping was written
  into the source, so the abstraction that was supposed to survive a provider
  retiring a model existed only in the type. It is configuration now.

### Added

- **One command stops everything.** Every capability now descends from a single
  root, and revoking it takes all authority at once. Nothing has to cooperate and
  no machine has to be reachable: authority is checked at the moment it is used
  and never cached, so a worker on a machine nobody can contact simply finds its
  next action refused. Proven with a worker running in another process that was
  never signalled and never told, which stopped anyway.
- **The stop stays stopped.** Nothing can be granted while the system is halted,
  and starting again is a deliberate act that records who did it and why. Nothing
  that was revoked comes back with it.
- **`pnpm stop:test` runs the emergency stop proof on its own.** It is meant to
  be re-run at every stage boundary, forever. An untested stop is a belief rather
  than a control.

### Fixed

- **The emergency stop would not have stopped anything.** Two comments in the
  code said every capability descended from a root and that revoking it removed
  all authority. Neither was true: every capability was its own root, so the stop
  would have revoked one of them and left every other worker running. The comment
  describing an intention as though it were a fact is the worse half of that.
- **Anything granted after a stop silently restarted the system.** The first
  grant after a halt created a fresh root and authority resumed, with nobody
  deciding to lift anything and the log still saying the system was stopped.
  Found by proving the stop rather than by reading it.

## [0.7.0] - 2026-09-09

### Added

- **Finishing the work is no longer the same as succeeding.** An objective is
  judged against the contract that was frozen when it was admitted, one criterion
  at a time, and the answer is never a yes or a no. It is a verdict per criterion
  with the evidence behind each one, so partial progress is visible and a worker
  knows exactly what is left rather than starting again.
- **A worker cannot mark its own work accomplished.** The authority to judge an
  objective cannot be given to anyone who worked on it, and if it was given
  before they started, it stops working the moment they do. Both refusals are
  written down as prominently as any use.
- **"We cannot tell" is an answer, and it stops everything.** A single criterion
  that cannot be judged suspends the objective even when every other one passed.
  It is never rounded up into success, which is how false completions get into a
  record that is never edited, and never rounded down into failure, which throws
  away work that really happened.
- **A verdict about a commit asks the remote, not the machine that made it.** If
  the machine reporting success is the one under suspicion, its report is the
  weakest evidence available rather than the strongest. Claims the world does not
  support come back empty instead of being believed.

## [0.6.0] - 2026-09-09

### Added

- **A worker can change a repository without ever holding the credential.** It
  describes what it wants to exist and gets back a commit hash. The key, the
  token and the remote's address all live on the other side of that call, and the
  worker process is started without them, so this is enforced by the credential
  not being there rather than by the worker choosing not to use it. The proof
  greps the worker for it.
- **A push that might not have landed is settled by asking the remote.** Every
  commit carries the id of the intent that asked for it, so after a crash the
  question "did this happen" has a definite answer that comes from the world
  rather than from anything the crashed process claimed. Crash after the push and
  it is recorded, not repeated. Crash before it and it re-runs. Either way there
  is exactly one commit.
- **Work in progress on a machine now says how it survives that machine.** Every
  capability declares a checkpoint procedure alongside its effect class, and one
  that cannot be granted without it. A worker holding a working tree pushes as it
  goes, so the work is never only in one place, and when a machine dies with
  unsaved edits the loss is written down instead of being an absence somebody
  notices weeks later.

### Fixed

- **A known vulnerability in the test runner.** Vitest is on 4.1.11, past an
  advisory allowing arbitrary file reads through the mocker. It was a major
  version away and dependency updates deliberately do not propose those, so it
  needed doing on purpose.
- **Workflows held more power than they used.** Every workflow now starts with
  read only permission and each job asks for exactly what it needs, so a job
  added later inherits nothing.
- **A required field was accepted and thrown away.** Every capability had to
  declare how its local state is preserved, the compiler enforced it, and the
  value was then dropped before it reached the log, so everything read back as
  though it held nothing. A required field that is silently discarded is worse
  than an optional one, because the compiler says it is handled.
- **Committing twice to the same branch failed the second time.** The broker
  cloned the default branch and forced the target branch on top of it, which
  looks right and quietly discards every commit already there.

## [0.5.1] - 2026-09-09

### Fixed

- **A closed release blocked its own version forever.** The check for an existing
  release pull request counted closed ones, so once a release was closed rather
  than merged, every later attempt at that version found it, decided a pull
  request already existed, opened nothing, and reported success. Only an open one
  counts now.

## [0.5.0] - 2026-09-09

### Added

- **A worker survives its machine dying.** Kill the node mid-objective and start
  another one. It is given the objective and nothing else, reads what already
  happened out of the log, skips the steps that finished, retries the one caught
  in the crash, and completes. No human restates anything, and nothing is stored
  on the node, because a machine that crashed did not get to write a resume file
  on the way down.
- **Two machines cannot run the same worker.** A worker runs under a lease
  carrying a number that only goes up, every write carries it, and the log
  refuses a write from an older lease. The machine that lost its lease finds out
  the next time it writes, and stops. The check lives in the database on purpose:
  the whole situation is a machine that lost its lease and does not know it, and
  that machine cannot be the one to check.
- **What to do after a crash was decided before it.** Every intent records
  whether repeating the effect is safe, so recovery reads the answer instead of
  guessing. Anything it does not recognise goes to a human rather than being
  assumed harmless.

### Changed

- **The first real answer to the question the whole runtime rests on.** A
  resumed worker reached its objective without duplicating work it did not have
  to or wavering between approaches. Written up with the reasons it is weaker
  evidence than it looks: the worker followed a fixed list, so it had no approach
  to waver between, and the interrupted step was of the kind that is safe to
  repeat. To be measured again when both of those stop being true.

### Added

- **A model is a resource authority can be held over.** A capability can now say
  "may invoke a fast model, up to this much", with a model class rather than a
  vendor's product name, so a capability granted today does not name a model that
  gets retired next year. Containment for a model class is equality and not a
  hierarchy: holding `reasoning` does not quietly also grant `fast`, because an
  ordering invented in code is authority nobody granted.
- **A proof passed while the thing it tested was not happening.** The check that
  the file contained what the model decided compared an empty file to an empty
  answer, so it went green in an environment where no model call worked at all.
  The slice 4 proof now runs against a scripted provider with known costs, which
  needs no subscription and makes the budget arithmetic exact, and what the real
  provider does is proven separately on a machine that has one.
- **A budget that cannot fund one call is exhausted, even though it is not
  empty.** Found by writing the proof for the exhaustion criterion and watching
  it never exhaust: a worker with a few micro-dollars left attempted a call, the
  provider refused it for having no budget, the refusal consumed nothing, the
  balance was untouched, and the same call could be attempted again forever. A
  budget failure is supposed to suspend and escalate, not spin.
- **Budgets are three numbers that move.** Granted, reserved and settled, held in
  the log like everything else. A reservation is taken when an effect is intended
  and released when it settles, released by the amount reserved rather than the
  amount spent, so a call that comes in under estimate returns the difference
  instead of leaking it out of the budget forever. A process that dies holding a
  reservation leaves it held, which is the safe direction and the entire reason
  there are three numbers rather than one.
- **The model runs on a Claude subscription, with no API key anywhere.** Model
  calls are made by the local Claude Code CLI, in the control plane, never in a
  worker. Two existing rules put it there before cost was considered: workers
  never hold credentials, and the worker path must be incapable of spawning a
  process.

### Fixed

- **A model call could have used tools, and nearly did.** The provider's CLI is
  an agent, not a model endpoint, and the first version denied its tools by name.
  Probing found the model reaching straight past that list for an MCP tool from
  the machine's own configuration, which no list had ever heard of. Tools are now
  absent rather than denied, and two checks after the fact catch anything that
  survives without needing to know its name.
- **Model calls were reading the repository.** Run from the project directory the
  CLI loaded `CLAUDE.md` and the working tree into every call, and answered
  questions by citing "the project instructions". Repository contents are
  untrusted content, so that was an injection path straight into the worker's
  decisions. Calls now run from an empty directory with the provider's own system
  prompt replaced.
- **Model calls cost about twenty times more than they needed to.** The overhead
  was the agent scaffolding, not the model: 18,650 tokens to answer a ten token
  question, against 411 once the call is contained.

## [0.4.1] - 2026-09-09

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

# Contributing

Maschina is early. The architecture is settled enough to build against, but
almost nothing is proven yet, so the most useful contribution right now is
finding where the design is wrong rather than adding to it.

## Before you start

Open an issue first. Maschina has a deliberately narrow scope at this stage and a
lot of reasonable-sounding features are out of scope on purpose. Finding that out
after you have written the code is a bad afternoon.

## Setup

Needs Node 22+, pnpm, and Docker.

```bash
pnpm install
pnpm db:up
pnpm maschina db init
pnpm proof
```

If `pnpm proof` passes, your environment is correct.

## The rules that matter

**A change is done when its proof runs.** Not when the code looks right, and not
when it demos. If you cannot describe how to verify a change by hand, it is not
finished.

**Nothing reaches the world unrecorded.** Every effect is written to the event log
before it is attempted, and its outcome is written after. If you find a code path
where something happens without a preceding record, that is a bug even if it
works.

**Failures stop.** No silent fallbacks, no swallowed errors, no degrading to a
cheaper path without saying so. If the system cannot tell whether something
happened, it records that it does not know and stops. Guessing is worse than
halting.

**Authority is never ambient.** Nothing gets permission from the machine it runs
on, the user it runs as, or the environment it can read. If your change makes
something possible without an explicit grant, it is wrong.

## Style

Biome handles formatting and linting. Run `pnpm check` before you push, or let
the pre-commit hook do it.

Two things Biome cannot check:

- **No em dashes.** Anywhere, including comments. Use a colon after a short label,
  a comma inside a longer clause, or two sentences. There is a CI check for this.
- **Comments explain why, not what.** If a comment restates the code, delete it.
  If a decision looks strange, write down the reason, because you will forget.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(db): add causation index to the event log
fix(cli): stop swallowing connection errors on append
docs: correct the slice 5 proof steps
```

The subject line is release copy. Write it so someone reading a changelog
understands what changed without opening the diff.

## The changelog

Every change gets an entry under `## [Unreleased]` in `CHANGELOG.md`, in plain
language, for someone who did not write the code.

**Say what is different, not how it works.** Name the behaviour somebody would
notice. Two sentences is usually enough. An entry that needs a paragraph to
explain the mechanism is an entry that should be one line, with the mechanism in
a decision record instead.

**Never edit an entry that has already shipped.** A changelog is a record.
Rewriting what it said, even to improve it, makes the whole file worth less than
no file at all. New rules apply from the next version onward.

## Pull requests

Keep them small and keep them to one thing. Say what you changed, why, and how
you verified it. If you added behaviour, say how to prove it works by hand.

CI runs Biome, typecheck, tests, and the proofs against a real Postgres. All of it
has to pass.

## Security

Do not open an issue for a vulnerability. See [SECURITY.md](SECURITY.md).

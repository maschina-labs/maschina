<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/kit/wordmark-white.svg">
  <img alt="Maschina" src="apps/web/public/brand/kit/wordmark-black.svg" width="360">
</picture>

### Software that goes to work.

A machine on Maschina has its own Solana wallet, a budget it cannot exceed, rules it cannot break and
a permanent record. Its money can only ever go back to its owner. The owner sets what a machine may
do; the machine does that and only that, and writes down everything it did.

AI decides. Maschina decides what it is allowed to do.

Trading is the first job because it is the hardest test: real money, around the clock, fast. After it:
machines that sell services, hire each other, get published and copied, and run on a network of other
people's computers that get paid for it.

---

## Where to look

|  |  |
| --- | --- |
| **The live record** | [live.maschina.dev](https://live.maschina.dev) · what the machines actually did, no sign-in |
| **The app** | [app.maschina.dev](https://app.maschina.dev) |
| **The API** | [api.maschina.dev](https://api.maschina.dev) · `/v1/status`, and `/openapi.json` describes every route |
| **Docs** | [docs.maschina.dev](https://docs.maschina.dev) |
| **Status** | [status.maschina.dev](https://status.maschina.dev) |
| **What changed** | [CHANGELOG.md](CHANGELOG.md) |
| **Reporting something** | [SECURITY.md](SECURITY.md) |

Every package and service has its own README saying what it owns and what it must never do. Start
with [`services/signer`](services/signer) if you want to see where authority actually lives.

## Status

Early, and built in the open since 2026-09-16.

A machine has been trading real money on Solana since 2026-09-28, with the founder's own funds. There
are no outside users. **The system has not had an independent security audit.** Nothing here claims to
be finished that is not, and there are no promises about returns.

## How the limits hold

Three independent things have to agree before money moves, and any one of them can refuse.

1. **Maschina's rules** check the machine is running, the run is inside its window, both tokens are
   approved, and the trade fits the per-trade cap, the daily cap and the budget. An absent limit is
   never treated as permission. → [`packages/rules`](packages/rules)
2. **The database** holds the money before anything is signed and settles it afterwards, under a lock
   on that machine. Twenty trades racing for a budget that fits ten: exactly ten get through, proved
   against real Postgres. → [`packages/db`](packages/db), [`packages/integration-tests`](packages/integration-tests)
3. **The wallet provider** enforces the wallet's own policy and knows nothing about Maschina. It
   refuses SOL sent anywhere but the owner or the machine's own wrapped account, and denies key export
   to us permanently. A machine's vault is narrower still: no router, tokens only into the owner's own
   accounts. → [`packages/wallet`](packages/wallet)

A trade's signature is written to the record **before** the transaction is sent, so a crash leaves a
signature the chain can be asked about rather than a question nobody can answer. Nothing is retried on
an unknown outcome.

Above all three, a halt. While one is in force the signer refuses everything, and it fails closed:
not being able to tell whether a halt is in force refuses too. Stopping never needs the cooperation of
whatever went wrong.

## Paper mode, and what it does not prove

A paper machine is quoted by the real router at the real price, checked against an independent price,
and held to the same budget arithmetic as a machine with money. Then nothing is signed.

That proves the decision: whether a machine would have traded, at what price, and what it would have
done to the budget. It deliberately does **not** prove signing. A paper machine's request carries no
transaction at all, so the signer could not act on it if handed one. Saying otherwise would invert the
guarantee it is built on.

## Layout

```text
apps/          web (the company site), app (the dashboard), auth, docs, live (the public record)
services/      gateway (the public API), orchestrator (schedules and hands out work),
               signer (the only service that can request a signature), provisioner (makes a
               machine's wallet and policy), daemon (runs machines on a node), bots (Telegram)
packages/      core, contracts, db, rules, runtime, solana, wallet, auth, accounts, manager,
               sdk, service, env, config, telemetry, ui, field, testing, integration-tests
```

`pnpm check:boundaries` enforces who may import what. The signer is the only path to a signature, the
daemon never touches the database, and Solana libraries live in one place.

## Running it

Needs Node 24, pnpm 11 and Docker.

```bash
pnpm install
pnpm bootstrap   # writes .env, starts Postgres, runs migrations
pnpm dev         # the app and the gateway
```

```bash
pnpm check            # lint, format, architecture rules
pnpm typecheck
pnpm test
pnpm test:integration # needs Docker
pnpm gate             # everything CI runs
```

The interface is set in Söhne and the font files are not in this repository: the licence covers
serving a font for a site, not handing the files to everyone who clones it. `pnpm fonts` fetches them
for anybody who holds the licence, and without them everything builds and falls back to the system
font stack.

## Contributions

Not being accepted. This is a single-founder project and the repository is public for review rather
than for collaboration. Security reports are the exception and are always welcome, through
[SECURITY.md](SECURITY.md) rather than the issue tracker.

## Licence

**Source-available. Not open source.** The Functional Source License, Version 1.1, with an Apache 2.0
future license (FSL-1.1-Apache-2.0): read, run, change and build on it for any purpose except a
competing one, and each version becomes Apache 2.0 two years after it is published.

Full text in [LICENSE](LICENSE). Third party code keeps its own licenses in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

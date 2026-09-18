# Maschina

A machine with its own wallet, a budget it cannot exceed, and no way to withdraw your money.

Maschina runs trading machines that work while their owner does not. An owner sets what a machine may
do: what it may spend, which tokens it may touch, how far a price may move, when it may act. The
machine does that and only that, and writes down everything it did. Later, machines will also work
jobs, pay for things and pay each other.

**This repository is source-available for review. It is not open source.** All rights are reserved: no
licence is granted to use, copy, modify or distribute this code. It is public while Maschina is in the
Crypto World's Fair hackathon so judges and readers can see how it is built.

## Status

Being built, in the open, since 2026-09-16. Not usable yet, and nothing here pretends to be finished
that is not.

Working today, each proved against real services rather than mocks:

| What | Where to look |
| --- | --- |
| Quotes, prices, swap transactions, confirmation | `packages/solana` |
| Signing through Turnkey, under a policy Turnkey enforces | `services/signer/src/provider` |
| Maschina's own rules, checked before every signature | `packages/rules/src/trade.ts` |
| Budgets held and settled inside one database transaction | `packages/db/src/ledger.ts` |
| A trade sent at most once, ever | `services/signer/src/submit-once.ts` |
| The permanent record, append only | `packages/db/src/record.ts` |

Not built yet: scheduling and running machines on their own, the API, and the web app beyond a landing
page.

## How the limits actually hold

Three independent things have to agree before money moves, and any one of them can refuse.

1. **Maschina's rules** (`packages/rules/src/trade.ts`) check the machine is running, the run is inside
   its window, both tokens are approved, and the trade fits the per-trade cap, the daily cap and the
   budget. An absent limit is never treated as permission.
2. **The database** holds the money before anything is signed and settles it afterwards, under a lock
   on that machine. Twenty trades racing for a budget that fits ten: exactly ten get through. That test
   runs against real Postgres, in `packages/integration-tests`.
3. **The wallet provider** enforces the wallet's own policy and knows nothing about Maschina. It refuses
   a payment to an address nobody approved, and it denies key export to us permanently. Proved against
   the real provider with `pnpm --filter @maschina/signer check:turnkey`.

A trade's signature is written to the record before the transaction is sent, so a crash leaves a
signature the chain can be asked about rather than a question nobody can answer. Nothing is ever
retried on an unknown outcome.

## Layout

```text
apps/
  web/                 the web app
services/
  gateway/             the public API
  orchestrator/        schedules machines and hands out work
  signer/              the only service that can request a signature
  daemon/              runs machines on a node
  bots/                chat platforms, starting with Telegram
packages/
  core/                shared types, ids, errors, money
  runtime/             the loop every machine runs
  rules/               budgets and limits
  db/                  the database schema and the permanent record
  solana/              everything that talks to Solana
  contracts/           API schemas shared by the gateway and apps
  env/                 environment validation
  telemetry/           logging and error reporting
  sdk/                 for developers building their own machines
  ui/                  shared interface components
  config/              shared TypeScript configuration
  testing/             test factories and helpers
  integration-tests/   tests against a real database
```

Every package has a README saying what it owns and what it must never do.

## Running it

Needs Node 24, pnpm 11 and Docker.

```bash
pnpm install
pnpm bootstrap  # creates .env, starts Postgres, runs migrations
pnpm dev        # web app on :3000, gateway on :4000
```

```bash
pnpm check:machine       # checks your machine is set up correctly
pnpm check               # lint, format, architecture rules
pnpm typecheck
pnpm test
pnpm test:integration    # needs Docker
pnpm gate                # everything CI runs
```

## Contributions

Not being accepted. This is a single-founder project and the repository is public for review rather
than for collaboration.

Security issues are the exception and are always welcome, through [SECURITY.md](SECURITY.md) rather
than the issue tracker.

## Licence

None, deliberately. All rights reserved: you may read this code, and you may not use, copy, modify or
distribute it. Public is not the same as open source.

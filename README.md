# Maschina

Give software a job and money, safely, so it can go to work for you.

A machine on Maschina has its own Solana wallet, a budget it cannot exceed, rules it cannot break and a
permanent record, and its money can only ever go back to its owner. An owner sets what a machine may
do. The machine does that and only that, and writes down everything it did.

Trading is the first job, because it is the hardest test: real money, around the clock, fast. Next,
machines sell services, hire each other and work in teams, proven machines are published, copied and
sold, and machines run on a network of people's computers, which get paid.

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
| The signer end to end: rules, then the budget, then sign, send and settle at the real cost | `services/signer/src/compose.ts` |
| What a landed trade actually cost, read back from the chain | `packages/solana/src/trade-cost.ts` |
| Nodes claiming runs, asking about them and reporting on them, only while they hold the lease | `services/orchestrator`, `services/daemon` |
| Trades proposed by a node, passed to the signer only for a run it holds | `services/orchestrator/src/propose-route.ts` |
| A node running a machine: its balances, its decision, a quote checked against an independent price, a proposal | `services/daemon/src/machine-runner.ts` |
| A node running machines on its own: claim, run, report, repeat, keeping its lease alive | `services/daemon/src/work-loop.ts` |
| Watching prices for waiting machines, and queueing a run once per crossing | `services/orchestrator/src/price-watcher.ts` |
| The permanent record, append only | `packages/db/src/record.ts` |

Not built yet: anything that queues runs on a schedule, a machine's own wallet created with
it, the API, and the web app beyond a landing page.

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

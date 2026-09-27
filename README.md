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
| A sale held to none of the budget or the caps, because it spends none of the budget: the same rule when a trade is held as when the record is read | `packages/rules/src/trade.ts`, `packages/db/src/ledger.ts` |
| A trade sent at most once, ever | `services/signer/src/submit-once.ts` |
| The signer end to end: rules, then the budget, then sign, send and settle at the real cost | `services/signer/src/compose.ts` |
| What a landed trade actually cost, read back from the chain | `packages/solana/src/trade-cost.ts` |
| Nodes claiming runs, asking about them and reporting on them, only while they hold the lease | `services/orchestrator`, `services/daemon` |
| Trades proposed by a node, passed to the signer only for a run it holds | `services/orchestrator/src/propose-route.ts` |
| A node running a machine: its balances, its decision, a quote checked against an independent price, a proposal | `services/daemon/src/machine-runner.ts` |
| A node running machines on its own: claim, run, report, repeat, keeping its lease alive | `services/daemon/src/work-loop.ts` |
| Watching prices for waiting machines, and queueing a run once per crossing | `services/orchestrator/src/price-watcher.ts` |
| A machine waiting on more than one price at a time, each edge arming and firing on its own | `packages/runtime/src/machine-kind.ts` |
| A machine on paper: quoted for real, checked for real, recorded, and never signed | `services/orchestrator/src/paper-signer.ts` |
| What a machine on paper holds, worked out from its own record | `packages/runtime/src/paper-holdings.ts` |
| The range machine: buys the low edge, sells the high edge, one position at a time | `packages/runtime/src/kinds/range.ts` |
| Refusing a band too narrow to cover what trading it costs | `packages/rules/src/edge.ts` |
| Holding a trade to the fee its own bytes will pay, not the fee a router claims | `packages/solana/src/compute-budget.ts` |
| Stopping everything at once, at the signer, so it works without the cooperation of whatever went wrong | `services/signer/src/while-halted.ts` |
| Returning a machine's funds to its owner, with the destination looked up rather than accepted | `services/signer/src/withdraw.ts` |
| Whether a machine has actually made money, net of what it paid | `packages/runtime/src/machine-pnl.ts` |
| How far above its float a machine is, at every moment, including while it holds the other side | `packages/runtime/src/machine-float.ts` |
| Refusing to sweep profit for forty cents, or against a position whose value is still an opinion | `packages/rules/src/float.ts` |
| A wallet policy that pins where a token may go, not only which token may move | `packages/wallet/src/turnkey-policy.ts` |
| A vault beside every machine, whose key cannot sign a trade, checked against the real Turnkey | `services/provisioner/src/create-machine.ts`, `services/provisioner/scripts/check-vault.ts` |
| Refusing a transaction that looks like a swap and moves money out around it, checked against real Jupiter routes | `packages/solana/src/swap-instructions.ts` |
| Banking profit above the float into the vault: decided from the chain and the record, checked byte by byte, sent once | `services/signer/src/sweep.ts`, `packages/solana/src/sweep.ts` |
| A machine's own wallet, made with its policy and checked before the machine exists | `services/provisioner` |
| Refusing a machine that could never trade, an unknown kind, unreadable settings, a band too narrow or an unapproved token, before a wallet is made | `packages/runtime/src/check-settings.ts` |
| Signing in with a wallet, by signing a sentence and never a transaction | `packages/auth`, `services/gateway/src/routes/auth.ts` |
| An API where an owner only ever reaches their own machines | `services/gateway/src/routes/machines.ts` |
| The permanent record, append only | `packages/db/src/record.ts` |

The API is live at `https://api.maschina.dev`: `/v1/status` says it is up and `/openapi.json` describes
every route. Owner routes need a signed-in wallet, which is a signature over a sentence rather than a
transaction.

**Not built yet**, and worth being plain about, because the safety layer being finished is not the same
as the product being finished:

- **No machine has made a real trade on mainnet.** Everything below has been proved against real
  Turnkey, a real database and live Jupiter prices, and a machine has completed whole round trips on
  paper. Nothing has yet spent a real dollar.
- **Withdrawal is not usable by a person.** The signer path exists and has been run against real
  Turnkey and real Solana, and there is no button and no public route in front of it yet.
- **Sweeping on its own.** The signer can bank a machine's profit into its vault when asked, and nothing
  asks it on a schedule yet.
- **Where a route sends its output is taken on trust.** A swap's tokens move inside the router's own
  instruction, and neither the provider nor Maschina yet reads where that instruction delivers the
  result. Everything around it is checked: a bare token transfer, a delegation, a close into somebody
  else's wallet or SOL sent anywhere but the machine's own wrapped account is refused before signing.
  Reaching this needs a node that builds a dishonest route, and every node today is Maschina's.
- **Schedules.** Runs are queued by price crossings today. Nothing queues a run because the clock said so.
- **Simulating a proposal** to prove it spends no more than it claims. The fee half is done; the amount
  half guards against a node Maschina does not run, which cannot happen yet.
- **The web app** is the machines list, one machine, and the states around them. Most of the navigation
  leads to screens that say what will be there and why they are empty.

## How the limits actually hold

Three independent things have to agree before money moves, and any one of them can refuse.

1. **Maschina's rules** (`packages/rules/src/trade.ts`) check the machine is running, the run is inside
   its window, both tokens are approved, and the trade fits the per-trade cap, the daily cap and the
   budget. An absent limit is never treated as permission.
2. **The database** holds the money before anything is signed and settles it afterwards, under a lock
   on that machine. Twenty trades racing for a budget that fits ten: exactly ten get through. That test
   runs against real Postgres, in `packages/integration-tests`.
3. **The wallet provider** enforces the wallet's own policy and knows nothing about Maschina. It refuses
   SOL sent anywhere but the owner or the machine's own wrapped SOL account, and it denies key export to
   us permanently. A machine's vault gets a narrower policy still: no router, and tokens only into the
   owner's own accounts. Proved against the real provider with
   `pnpm --filter @maschina/signer check:turnkey` and `pnpm --filter @maschina/provisioner check:vault`.

A trade's signature is written to the record before the transaction is sent, so a crash leaves a
signature the chain can be asked about rather than a question nobody can answer. Nothing is ever
retried on an unknown outcome.

Above all three, a halt. While one is in force the signer refuses everything, so stopping does not need
the cooperation of whatever has gone wrong, and it fails closed: not being able to tell whether a halt
is in force refuses too.

## Paper mode, and what it does not prove

A machine made with `paper: true` is quoted by the real router at the real price, checked against an
independent price, and held to the same budget arithmetic as a machine with money. Then its trade is
written into the record as `trade.intended` and `trade.simulated`, and nothing is signed.

What that proves is the decision: whether a machine would have traded, at what price, and what it would
have done to the budget. A range machine has completed whole round trips this way, and the loss it took
to fees came out of the record as a number.

What it deliberately does not prove is signing. A paper machine goes to a different route with a request
that has **no transaction in it**, so the signer could not act on it if it were handed one. Paper mode
exercises decisions, quotes, price checks, budget arithmetic and refusals. It does not exercise the
signature path, and saying otherwise would invert the guarantee it is built on.

## Layout

```text
apps/
  web/                 the web app
services/
  gateway/             the public API
  orchestrator/        schedules machines and hands out work
  signer/              the only service that can request a signature
  provisioner/         creates a machine: its wallet, its policy, its place in the record
  daemon/              runs machines on a node
  bots/                chat platforms, starting with Telegram
packages/
  core/                shared types, ids, errors, money
  runtime/             the loop every machine runs
  rules/               budgets and limits
  db/                  the database schema and the permanent record
  solana/              everything that talks to Solana
  wallet/              machine wallets and the policies that hold them
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

The interface is set in Söhne, and the font files are not in this repository: a licence covers serving
a font for your own site, not handing the files to everybody who clones it. `pnpm fonts` fetches them
for anybody who holds the licence. Without them everything builds and runs, and falls back to the
system font stack.

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

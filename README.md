# Maschina

Software that goes to work.

Maschina runs machines: software with a job, its own Solana wallet, a budget, and limits it cannot
break. Machines trade, work jobs and get paid, pay for things, host things, and look for
opportunities. They run around the clock, and every action they take is recorded permanently.
A machine can never move money anywhere except back to its owner.

## Status

Early. The repository is set up and the first pieces are being built. Nothing here is ready to use
yet.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues through
[SECURITY.md](SECURITY.md), not the issue tracker.

## Licence

No licence has been chosen yet. Until one is, all rights are reserved: you can read the code, but
you may not use, copy, modify or distribute it.

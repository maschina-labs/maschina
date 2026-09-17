# Wallet provider findings

The question: which wallet provider holds Maschina's machine wallets? Turnkey and Crossmint are tested
against the same checklist (`src/checklist.ts`) before any Maschina code depends on either.

## Running it

```bash
pnpm install    # inside spikes/wallet-provider, separate from the main workspace
infisical run --env=dev --path=/wallet-spike -- pnpm check:credentials
infisical run --env=dev --path=/wallet-spike -- pnpm setup:turnkey   # signer, wallet and policies
infisical run --env=dev --path=/wallet-spike -- pnpm setup:crossmint # Crossmint wallet and machine signer
infisical run --env=dev --path=/wallet-spike -- pnpm prepare:crossmint # token accounts the Crossmint checks use
infisical run --env=dev --path=/wallet-spike -- pnpm check:turnkey   # refusal checks
infisical run --env=dev --path=/wallet-spike -- pnpm check:crossmint
infisical run --env=dev --path=/wallet-spike -- pnpm check:recipients turnkey   # or crossmint
infisical run --env=dev --path=/wallet-spike -- pnpm time:providers   # wallet creation and signing times
infisical run --env=dev --path=/wallet-spike -- pnpm check:helius   # devnet and mainnet balances, read only
pnpm test       # the spike's own tests, no credentials needed
```

## Results

Filled in as each check is built. Every row links to its saved run in `results/`.

| Check | Expected | Turnkey | Crossmint |
| --- | --- | --- | --- |
| Credentials work | allowed | ok, 2026-09-16 | ok, 2026-09-16 (staging) |
| Policy attached and reads back as set (#22) | allowed | ok, 2026-09-16 | partly: scopes attached 2026-09-16, two rules can't be expressed ([setup](results/crossmint-setup-devnet.json)) |
| Wallet created | allowed | ok, 2026-09-16 (in #18) | ok, 2026-09-16, about 1.9 s ([setup](results/crossmint-setup-devnet.json)) |
| Policy attached and reads back as set | allowed | ok, 2026-09-16 ([setup](results/turnkey-setup-devnet.json)) | ok, 2026-09-17 ([setup](results/crossmint-setup-devnet.json)) |
| Transfer to the owner | allowed | ok, landed, [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | ok, landed, [run](results/crossmint-devnet-2026-09-17T07-50-14-310Z.json) |
| Transfer to any other address | refused | ok, refused, [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | ok, refused, [run](results/crossmint-devnet-2026-09-17T07-50-14-310Z.json) |
| Swap between approved tokens | allowed | ok, landed (wrapped SOL to the owner), [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | ok, landed (wrapped SOL to the owner), [run](results/crossmint-devnet-2026-09-17T07-50-14-310Z.json) |
| Swap into an unapproved token | refused | ok, refused, [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | ok, refused, [run](results/crossmint-devnet-2026-09-17T07-50-14-310Z.json) |
| Call an unapproved program | refused | ok, refused, [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | **failed: landed.** Scopes can't restrict programs, [run](results/crossmint-devnet-2026-09-17T07-50-14-310Z.json) |
| Transfer just under the size limit | allowed | ok, landed (0.049 SOL), [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | ok, landed (0.009 SOL of 0.01 per minute), [run](results/crossmint-devnet-2026-09-17T07-50-14-310Z.json) |
| Transfer just over the size limit | refused | ok, refused (0.051 SOL), [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | ok, refused (0.011 SOL), [run](results/crossmint-devnet-2026-09-17T07-50-14-310Z.json) |
| Pay an approved recipient | allowed | ok, landed, [run](results/turnkey-recipients-devnet-2026-09-17T08-08-10-884Z.json) | ok, landed, [run](results/crossmint-recipients-devnet-2026-09-17T08-08-55-299Z.json) |
| Pay an unapproved recipient | refused | ok, refused, [run](results/turnkey-recipients-devnet-2026-09-17T08-08-10-884Z.json) | ok, refused, [run](results/crossmint-recipients-devnet-2026-09-17T08-08-55-299Z.json) |
| Pay a removed recipient | refused | ok, refused, [run](results/turnkey-recipients-devnet-2026-09-17T08-08-10-884Z.json) | ok, refused, [run](results/crossmint-recipients-devnet-2026-09-17T08-08-55-299Z.json) |
| Real Jupiter swap on mainnet | allowed | moved to the first real swap, after the provider is chosen | moved, as for Turnkey |

A refusal only counts when its allowed pair passed in the same run. An error is never a refusal.

## Turnkey policy (#18)

- **Root users skip policies.** Machine wallets are signed for by `spike-signer`, a user with no root
  powers, whose key lives only in Infisical. For everyone but root, Turnkey refuses anything no policy
  allows.
- **`machine:devnet:sign`** (allow) covers only `spike-signer`, only signing transactions, and only for
  the machine wallet. It requires all of these:
  - every program called is approved (System, Compute Budget, Token, Associated Token)
  - every SOL transfer goes to the owner and moves at most 0.05 SOL
  - every token transfer moves devnet USDC or wrapped SOL
- **`machine:devnet:no-export`** (deny) means the signer can never export keys, whatever else is allowed.
- **Checked inputs.** Every address is checked to decode to 32 bytes before it goes into a policy, so no
  value can change a policy's meaning. That check caught a mistyped program id while this was being
  written.
- **Reruns.** `pnpm setup:turnkey` can be run again safely. It changes only what's missing or different,
  then reads every policy back and fails if Turnkey stored anything else.

## Turnkey refusals on devnet (#19)

`pnpm check:turnkey` signs as `spike-signer` and runs each check for real. Allowed transactions land on
devnet. Transactions that should be refused are never sent.

- **Every forbidden transaction was refused, and every allowed one landed**, on the first run with the
  final classifier (2026-09-16).
- **How Turnkey says no.** A policy denial is not an activity status. It is an error with code 7 and a
  `PolicyEnginePermissionError` detail listing each policy's outcome (`OUTCOME_DENY_IMPLICIT` when
  nothing allowed it). The first run, kept in `results/` as a record, labelled those as errors because
  the classifier expected an activity status. It now looks for that structured detail, and the words in
  a message never count on their own.
- **Wrapping SOL needed a policy change,** as #18 predicted. A swap from SOL moves SOL into the wallet's
  own wrapped SOL account, so that account is now an approved recipient alongside the owner.
- **Each allowed run costs about 0.06 devnet SOL.** Most of it goes to the owner, so it can be sent back.
- **The token checks use checked transfers of wrapped SOL** (allowed) and of a made-up mint (refused).
  Real Jupiter swaps are checked on mainnet in #20.

Still open:

- Token transfer rules only see the mint on checked transfers. A plain `Transfer` has no mint, so it
  fails the rule, which is safe but may block some Jupiter routes (#20).
- The size limit covers SOL transfers. Limiting swap size needs Jupiter's instruction data, which Turnkey
  can read only if Jupiter's IDL is uploaded.
- Jupiter uses address lookup tables. How Turnkey resolves accounts behind them needs testing.

## Crossmint wallet (#21)

- **Wallet:** `pnpm setup:crossmint` created a Solana smart wallet on Crossmint staging, which uses devnet:
  `3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF`, in about 1.9 seconds. A second run finds it instead of
  creating another.
- **Custody:** the wallet's recovery signer is a server signer. Maschina generates the secret
  (`xmsk1_` and 32 random bytes), keeps it in Infisical, and Crossmint's SDK derives the Solana signing
  key from it on Maschina's side. According to Crossmint's docs the secret never reaches them.
  - Whoever holds that secret has full control of the wallet. Nothing sits between the secret and a
    signature the way Turnkey's policy engine does.
  - A server signer can only be used through Crossmint's SDK, not plain REST.
- **SDK:** it's aimed at browsers and pulls in EVM and Stellar libraries, an older Solana library
  (`@solana/web3.js`), and packages expecting TypeScript 5 and Zod 3. It also logs every call to the
  console by default.
- **Advisories:** installing it brought in four packages with published advisories: two in `ws` (one
  high, through viem), one in `uuid` and one in `stream-json` (both through `@solana/web3.js`'s RPC
  client).
  - `ws` and `uuid` are overridden to patched versions.
  - `stream-json`'s patched version moved the modules its user loads, so that advisory is ignored with
    the reason recorded: the code that loads it is never used by the Solana client.
  - Turnkey's SDK brought in none.
- **Licence:** Crossmint's SDK needs `@solana/web3.js` 1.x, which depends on `rpc-websockets`, licensed
  LGPL-3.0. A production signer built on Crossmint's SDK would carry that dependency, which Maschina's
  licence check refuses today. Turnkey's SDK has no such dependency.

## Crossmint scopes (#22)

`pnpm setup:crossmint` also registers the machine's own signer, a keypair whose secret lives only in
Infisical, as a delegated signer on the wallet. The server signer approves it. Its scopes read back
exactly as set:

- **SOL** (`solana:sol`): to the owner, the wallet's own wrapped SOL account and the owner's wrapped SOL
  account, at most 0.01 SOL per minute (small, so the limit checks cost little)
- **wrapped SOL** (`solana:So111...112`): to the owner, with no limit of its own

The rules compare with the machine wallet policy like this:

| Machine wallet rule | Turnkey | Crossmint |
| --- | --- | --- |
| SOL only to the owner (and the wallet's own accounts) | Policy | Scope recipients |
| Only approved tokens | Policy, on checked token transfers | Scope tokens, for transfers made through Crossmint |
| A maximum size per transaction | Policy, per transfer | **Not expressible.** Only a total per interval |
| Only approved programs | Policy | **Not expressible.** Scopes only describe transfers |
| The signer can never export keys | Explicit deny policy | Not applicable, since the keypair is Maschina's own |
| Where the rules are enforced | Turnkey's secure enclave, at signing | Crossmint's smart account program, on-chain (seen in #23), and checked in simulation before broadcast |

## Crossmint refusals on devnet (#23)

`pnpm check:crossmint` sends each check as the machine's scoped signer. Crossmint checks, signs and
broadcasts in one call, so a forbidden transaction it allows really lands. On devnet that's harmless.

Final run, 2026-09-17 ([run](results/crossmint-devnet-2026-09-17T07-50-14-310Z.json)):

| Check | Expected | Crossmint |
| --- | --- | --- |
| Transfer to the owner | allowed | landed |
| Transfer to any other address | refused | refused on-chain: `RecipientNotAllowed` (6017) |
| Swap between approved tokens (wrapped SOL to the owner) | allowed | landed |
| Swap into an unapproved token (devnet USDC) | refused | refused on-chain: `OperationNotPermitted`, a token with no scope can't leave the wallet |
| Call an unapproved program (a memo) | refused | **landed.** Scopes can't restrict programs |
| Transfer just under the limit (0.009 of 0.01 SOL per minute) | allowed | landed |
| Transfer just over the limit (0.011 SOL) | refused | refused on-chain: `SpendingLimitExceeded` (6012) |

The run is marked failed because of the memo. That is the result, not a fault in the check: Crossmint
can't stop a machine's signer from calling any program, as long as no balance moves where the scopes
don't allow. Earlier runs in `results/` record the scope mistakes described below.

- **Enforcement is on-chain.** Refusals come from Crossmint's smart account program
  (`XmSwiXQsxSZYKVYbSAkkvQVvdrKo1nwwfvZBPQrLzbU`, `enforcement.rs`) during simulation, with a named
  error. That is stronger than the docs suggest. The classifier only counts those named enforcement
  errors as refusals.
- **The program checks after the transaction has run, not before.** Its logs show every inner
  instruction succeeding, then the policy check failing. It compares balances before and after:
  - A transfer bigger than the wallet holds fails with the System program's "insufficient funds" before
    the limit is looked at, so the over-limit check needs a wallet holding more than the limit.
  - Wrapped SOL moves real SOL. When a transaction wraps SOL and sends it on, the SOL ends up in the
    owner's wrapped SOL account, so that account has to be a SOL recipient as well.
  - An instruction that creates a token account for someone else makes that account a recipient too.
    The token checks only send to accounts that already exist (`pnpm prepare:crossmint` creates them,
    paid by the Turnkey test wallet).
- **Tokens are refused by default.** A balance going down with no scope for that token fails with
  `OperationNotPermitted`, so an unapproved token can't leave the wallet even though no rule names it.
- **Token recipients are wallets.** A token scope listing the owner's token account refused the
  transfer. Listing the owner's wallet allowed it.
- **Crossmint caps the rent it covers per day.** Staging stopped with `DAILY_RENT_CAP_EXCEEDED`:
  10,000,000 lamports (0.01 SOL) per rolling day. Creating token accounts counts against it.
- **Timing:** allowed transactions took a few seconds each through Crossmint's API.
- **The SDK can't be quieted.** It logs every call to the console, and the wallets SDK never passes a log
  level to its logger. On a server it also sends the same logs, including wallet addresses and
  transaction ids, to Crossmint's Datadog. A production adapter needs to account for both (#28).

Scopes can't be edited. Changing them means removing the signer and adding it again, which the setup
does when they differ.


## Approved recipients (#25)

`pnpm check:recipients turnkey|crossmint` adds a recipient to the machine wallet's rules, pays it, pays
a stranger, removes it, and pays it again. The recipient is the other provider's test wallet, so no
devnet SOL is lost. The recipient is always removed at the end, even when a step fails.

| Check | Turnkey ([run](results/turnkey-recipients-devnet-2026-09-17T08-08-10-884Z.json)) | Crossmint ([run](results/crossmint-recipients-devnet-2026-09-17T08-08-55-299Z.json)) |
| --- | --- | --- |
| Pay the approved recipient | landed | landed |
| Pay a stranger | refused by the policy engine | refused on-chain: `RecipientNotAllowed` |
| Pay the recipient after removing it | refused by the policy engine | refused on-chain: `RecipientNotAllowed` |
| Wallet kept while the list changed | yes | yes |

- **Turnkey changes the list in place.** The signing policy is updated, and the next signature follows
  it. The signer keeps working throughout.
- **Crossmint replaces the signer's scopes.** Scopes can't be edited, so the machine's signer is removed
  and added again with the new list. Between those two steps the machine can't sign at all, and each
  change is an approval by the server signer. The wallet and the signer's address stay the same.
- **Crossmint's SDK logged errors while adding the signer back,** yet the change took effect, and the
  setup reads the scopes back to prove it. Its logs can't be trusted to show whether a call worked.
- A payment to a new address must leave it at least rent-exempt (about 0.00089 SOL), so the checks pay
  0.001 SOL.

## Turnkey and Crossmint compared (#26)

Everything below comes from this spike's runs, except prices, which come from each provider's pricing
page on 2026-09-17.

### Policy coverage

| Machine wallet rule | Turnkey | Crossmint |
| --- | --- | --- |
| SOL only to the owner and approved recipients | Enforced | Enforced |
| Only approved tokens | Enforced, on checked transfers | Enforced: a token with no scope can't leave |
| A maximum size per transaction | Enforced | **Not expressible.** Only a total per interval |
| Only approved programs | Enforced | **Not expressible** |
| Changing the recipient list | In place, the signer keeps working | The signer is removed and added again |
| Where it's enforced | Turnkey's secure enclave, before anything is signed | On-chain, by Crossmint's smart account program, after the transaction's instructions run |

Crossmint judges a transaction by how balances changed. Anything that moves no balance at the moment it
runs isn't judged at all, which is how the memo landed. The worry is instructions that hand over power
without moving money, such as a token `Approve` that lets someone else spend later, or changing a token
account's owner. **Untested.** Crossmint shouldn't be chosen without testing these first.

### Speed

| | Turnkey | Crossmint |
| --- | --- | --- |
| Create a wallet (3 runs, [timings](results/provider-timings-2026-09-17T16-14-04-100Z.json)) | median 228 ms (197 to 588) | median 407 ms (277 to 1,762). One earlier run: 1.9 s |
| Decide on a transaction | about 0.2 s to sign (5 runs, median 183 ms), about 0.3 s to refuse | 1 to 3 s to refuse |
| Allowed transfer, landed on devnet | 2 to 2.5 s, including sending and confirming | 3 to 9 s, Crossmint sends it |

Turnkey signs and Maschina sends, so Maschina controls priority fees and retries. Crossmint sends it
itself.

### Price

| | Turnkey | Crossmint |
| --- | --- | --- |
| Free | 1,000 wallets, 25 signatures a month | 1,000 active wallets a month |
| Paid | $0.10 a signature, or $99 a month and $0.05 a signature. Enterprise quoted "as low as $0.0015" | From $0.05 per active wallet a month, volume discounts |
| What drives the bill | Every signature, so every trade | Every wallet used that month, however much it trades |

With every machine trading once a day (about 30 signatures a month):

| Machines | Turnkey Pro | Turnkey at $0.0015 | Crossmint |
| --- | --- | --- | --- |
| 100 | about $250 a month | about $5 | free |
| 10,000 | about $15,000 | about $450 | about $450 |
| 100,000 | about $150,000 | about $4,500 | about $4,950 |

At the recorded fee (0.5% on scheduled trades, D-032), a machine buying $50 a day earns Maschina about
$7.50 a month. Turnkey at Pro rates costs $1.50 of that; a machine trading 50 times a day costs $75 a
month in signatures. **Turnkey only works at scale on Enterprise terms,** so the price has to be agreed
before launch, not discovered after.

### Custody, and if the provider disappears

- **Turnkey:** keys live in Turnkey's enclaves. Maschina's signer can't export them (an explicit deny
  policy). An authorised user can export a wallet, so funds could be moved out ahead of a shutdown.
  Their disaster recovery terms still need reading.
- **Crossmint:** the wallet is an on-chain smart account. Its admin key is derived from a secret
  Maschina holds, so in principle Maschina still controls the account without Crossmint, but every tool
  used here goes through Crossmint's API. Untested.

### SDK, documentation and support

- **Turnkey:** a small server SDK, no advisories, no licence problems. Policy errors come back
  structured, which made refusals easy to recognise. Docs were enough for everything here.
- **Crossmint:** aimed at browsers. It pulled in four packages with advisories and an LGPL dependency.
  It logs every call to the console with no way to turn it off, sends those logs to Crossmint's
  Datadog, and logged errors on calls that succeeded. Several behaviours (token recipients are wallets,
  checks run after the transaction, the daily rent cap on staging) were found by testing, not from
  the docs.
- **Outages:** both have public status pages (turnkey-status.com, status.crossmint.com). Their history
  loads in the browser, so it wasn't read here.

### Recommendation

**Turnkey.** It enforces every rule in the machine wallet policy, including the two Crossmint can't
express, and it refuses before anything is signed rather than after instructions have run. It is faster,
its SDK is clean, and its lists change without taking the machine offline.

The cost is the catch: per-signature pricing only works at Enterprise rates. Before launch, get an
Enterprise quote. If it's far above $0.0015 a signature, compare again, and test Crossmint's untested
gaps before switching.

## Helius (#15)

`pnpm check:helius` reads the owner's balance on devnet and mainnet with the development key from
Infisical, read only ([run](results/helius-2026-09-17T17-04-49-298Z.json)).

Free plan limits, from helius.dev/pricing on 2026-09-17: 1 million credits a month, 10 RPC requests a
second, 1 `sendTransaction` a second. The cheapest paid plan is $49 a month for 10 million credits, 50
requests and 5 sends a second.

- Tests that loop against Helius must stay well under 10 requests a second. The spike's checks send
  one transaction at a time.
- 1 send a second is fine for development and far too little for launch. The sending path is chosen
  with the other services.
- The production key is created with production (A5), in Infisical's production environment.

## Notes

- Turnkey's first API key belongs to the organisation's root user, which can do anything. The signer
  must get its own API user, limited by Turnkey policies to what it needs.

- Crossmint has no "who am I" endpoint. The credentials check asks for a wallet that can't exist and
  treats "not found" as proof the key was accepted. Confirmed against staging on 2026-09-16: a made-up
  key gets 403, and the real server key gets 404.
- Crossmint's staging console comes with pre-generated keys that have full access. Production needs its
  own server key limited to the scopes the signer uses.

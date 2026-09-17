# Wallet provider findings

The question: which wallet provider holds Maschina's machine wallets? Turnkey and Crossmint are tested
against the same checklist (`src/checklist.ts`) before any Maschina code depends on either.

## Running it

```bash
pnpm install    # inside spikes/wallet-provider, separate from the main workspace
infisical run --env=dev --path=/wallet-spike -- pnpm check:credentials
infisical run --env=dev --path=/wallet-spike -- pnpm setup:turnkey   # signer, wallet and policies
infisical run --env=dev --path=/wallet-spike -- pnpm setup:crossmint # Crossmint wallet
pnpm test       # the spike's own tests, no credentials needed
```

## Results

Filled in as each check is built. Every row links to its saved run in `results/`.

| Check | Expected | Turnkey | Crossmint |
| --- | --- | --- | --- |
| Credentials work | allowed | ok, 2026-09-16 | ok, 2026-09-16 (staging) |
| Wallet created | allowed | ok, 2026-09-16 (in #18) | ok, 2026-09-16, about 1.9 s ([setup](results/crossmint-setup-devnet.json)) |
| Policy attached and reads back as set | allowed | ok, 2026-09-16 ([setup](results/turnkey-setup-devnet.json)) | not run |
| Transfer to the owner | allowed | ok, landed, [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | not run |
| Transfer to any other address | refused | ok, refused, [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | not run |
| Swap between approved tokens | allowed | ok, landed (wrapped SOL to the owner), [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | not run |
| Swap into an unapproved token | refused | ok, refused, [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | not run |
| Call an unapproved program | refused | ok, refused, [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | not run |
| Transfer just under the size limit | allowed | ok, landed (0.049 SOL), [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | not run |
| Transfer just over the size limit | refused | ok, refused (0.051 SOL), [run](results/turnkey-devnet-2026-09-17T04-26-54-056Z.json) | not run |
| Pay an approved recipient | allowed | not run | not run |
| Pay an unapproved recipient | refused | not run | not run |
| Pay a removed recipient | refused | not run | not run |
| Real Jupiter swap on mainnet | allowed | not run | not run |

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

Next for Crossmint (#22): a separate delegated signer for the machine, restricted with scopes. Crossmint's
docs say scopes cover transfers only (a spending limit per token and a recipient allow list, plus an
expiry), and are checked by Crossmint's backend before broadcast. There is no scope for which programs a
transaction may call.

## Notes

- Turnkey's first API key belongs to the organisation's root user, which can do anything. The signer
  must get its own API user, limited by Turnkey policies to what it needs.

- Crossmint has no "who am I" endpoint. The credentials check asks for a wallet that can't exist and
  treats "not found" as proof the key was accepted. Confirmed against staging on 2026-09-16: a made-up
  key gets 403, and the real server key gets 404.
- Crossmint's staging console comes with pre-generated keys that have full access. Production needs its
  own server key limited to the scopes the signer uses.

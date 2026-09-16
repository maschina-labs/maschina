# Wallet provider findings

The question: which wallet provider holds Maschina's machine wallets? Turnkey and Crossmint are tested
against the same checklist (`src/checklist.ts`) before any Maschina code depends on either.

## Running it

```bash
pnpm install          # inside spikes/wallet-provider, separate from the main workspace
cp .env.example .env  # then fill in the credentials
pnpm check:credentials  # checks both providers' credentials
pnpm test             # the spike's own tests
```

## Results

Filled in as each check is built. Every row links to its saved run in `results/`.

| Check | Expected | Turnkey | Crossmint |
| --- | --- | --- | --- |
| Credentials work | allowed | not run | not run |
| Transfer to the owner | allowed | not run | not run |
| Transfer to any other address | refused | not run | not run |
| Swap between approved tokens | allowed | not run | not run |
| Swap into an unapproved token | refused | not run | not run |
| Call an unapproved program | refused | not run | not run |
| Transfer just under the size limit | allowed | not run | not run |
| Transfer just over the size limit | refused | not run | not run |
| Pay an approved recipient | allowed | not run | not run |
| Pay an unapproved recipient | refused | not run | not run |
| Pay a removed recipient | refused | not run | not run |
| Real Jupiter swap on mainnet | allowed | not run | not run |

A refusal only counts when its allowed pair passed in the same run. An error is never a refusal.

## Notes

- Crossmint has no "who am I" endpoint. The credentials check asks for a wallet that can't exist and
  treats "not found" as proof the key was accepted.

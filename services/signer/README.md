# @maschina/signer

The only service that can ask the wallet provider to sign a transaction.

Every trade and payment arrives here as a proposal. The signer checks it against the machine's rules
(budget, caps, approved tokens and recipients, schedule, whether the machine is still running),
reserves the cost, and only then asks the wallet provider to sign. The provider enforces the wallet's
own policy as a second, independent check.

Today it serves `/health`, `/ready` and an `/internal/v1/hello` that only the orchestrator can call.

```bash
pnpm signer      # port 4200
```

## Wallet provider

The signer talks to the wallet provider only through `src/provider/wallet-provider.ts`. Turnkey holds
machine wallets, with Crossmint as the fallback. Every provider adapter must pass the shared tests in
`src/provider/contract.ts`. `src/provider/memory.ts` passes them in memory, for tests of the layers above.

How the Turnkey work in the wallet provider spike (code at commit `1016be3`, notes in
`spikes/wallet-provider/FINDINGS.md`) maps onto the interface:

| Interface | Turnkey |
| --- | --- |
| `createWallet` | `createWallet` with one Solana account, then an allow policy for the machine's non-root signer and a deny policy on key export, read back before returning (`setupMachineWallet`) |
| `readPolicy` | `getPolicies`. The spike only compares the stored expression with the expected one; the adapter has to parse it back into a policy |
| `sign` | `signTransaction` as the non-root signer. A `PolicyEnginePermissionError` in the error details is `refused` (`turnkeySigner`) |
| `setRecipients` | `updatePolicy` on the allow policy, in place, then read back |
| `unavailable` | Network failures, rate limits and 5xx responses |

A Crossmint adapter would map `setRecipients` to removing the machine's signer and adding it back with
new scopes, and couldn't enforce `approvedPrograms` or `maxLamportsPerTransfer` itself, so the signer's
own checks would carry those.

**Owns:** turning an allowed proposal into a signed transaction.

**Never:** decides what to trade, accepts calls from anything but the orchestrator, or holds a key
itself. It is the only package allowed to import a wallet provider SDK, and runs on its own server
before anyone else's money is on the platform.

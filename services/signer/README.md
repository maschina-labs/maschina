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

**Owns:** turning an allowed proposal into a signed transaction.

**Never:** decides what to trade, accepts calls from anything but the orchestrator, or holds a key
itself. It is the only package allowed to import a wallet provider SDK, and runs on its own server
before anyone else's money is on the platform.

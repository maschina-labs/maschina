# @maschina/daemon

Runs machines on a node: Maschina's own servers today, other people's computers in stage C.

- **Dials out.** It opens the connection to the orchestrator and asks for work. Nothing connects to a
  daemon, so it works behind any home router.
- **Has an identity.** An id and an Ed25519 key pair, created on first start and stored with
  owner-only permissions.
- **Runs the runtime.** Each run follows the loop in `@maschina/runtime`.

Today it creates its identity and checks in with the orchestrator, backing off when it can't reach it.

```bash
pnpm daemon
```

**Owns:** doing the work.

**Never:** touches the database, signs anything, or holds a credential that can move money. A
dishonest daemon can only propose; the signer and the wallet policy decide.

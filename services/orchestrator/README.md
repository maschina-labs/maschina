# @maschina/orchestrator

Decides when machines run and hands the work to daemons.

- **Scheduler:** knows when every running machine is next due.
- **Price watcher:** queues a run when a price crosses a level a machine is waiting for.
- **Run queue:** each run is taken by exactly one daemon, enforced by the database.
- **Internal API:** daemons dial in and ask for work. The orchestrator never connects to a daemon.

Today it serves `/health`, `/ready` (checks the database) and an authenticated
`/internal/v1/hello` that daemons use to confirm they can reach it.

```bash
pnpm orchestrator      # port 4100
```

**Owns:** timing and the queue.

**Never:** signs anything, or holds wallet provider credentials.

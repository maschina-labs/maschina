# @maschina/runtime

The loop every machine runs, whatever its kind: restore, assemble, decide, authorize, record the
intent, execute, record the outcome, assess.

- **Run phases** can only move forward in that order, with a few defined early exits. Nothing reaches
  the world before its intent is recorded.
- **Failure classes** each have one response. Refusals and budget exhaustion are never retried. A
  limit that lifts at a known time waits without waking anyone.
- **Effect classes** say what recovery does after a crash: repeat, ask the world, or ask a person.

Pure. The daemon drives this loop; the orchestrator and signer supply what it needs.

**Owns:** how a run proceeds and how failures are handled.

**Never:** signs, touches the database or network, or branches on what kind of machine is running.

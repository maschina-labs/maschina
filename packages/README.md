# packages

Shared libraries. Anything imported from more than one place belongs here, so it
gets written once instead of once per app.

| Package | What it owns |
| --- | --- |
| `core` | The six primitives, and the vocabulary. No behaviour. |
| `db` | The event log. Schema, append, read. The only durable state. |
| `cli` | The `maschina` command. |

A `ui` package lands here as soon as a second surface needs a component, which is
the point at which writing it twice starts to hurt.

Packages export TypeScript source directly rather than a build output. Consumers
compile them. There is no build step to forget and no stale `dist` to debug.

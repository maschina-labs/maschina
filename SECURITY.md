# Security

## Reporting

Do not open a public issue for a security problem.

Report it privately through GitHub's [private vulnerability
reporting](https://github.com/maschina-labs/maschina/security/advisories/new), or by
email to the address on the maintainer's GitHub profile.

Please include what you found, how to reproduce it, and what an attacker gets out
of it. You will get a response within a few days. Maschina is a one-person project
right now, so please be patient beyond that.

## Scope

Maschina is pre-release and runs on a single operator's machine. There is no
deployment, no multi-tenancy, and no user data. What matters at this stage is the
authority model, because that is what the whole system rests on.

Things worth reporting:

- A way for a worker to act without holding a capability for it
- A way to widen authority instead of narrowing it
- A way to reach a credential from inside a worker
- A way to write, edit, or delete an event log entry
- A way for the desktop app's renderer to reach the filesystem or spawn a process
- A way to get past the sandbox on the worker execution path

Things that are known and not worth reporting yet:

- Local Postgres credentials are literal and in the repository. They protect
  nothing that exists outside a developer's machine.
- The root capability is a database row rather than hardware-backed. This is a
  recorded, deliberate decision for this stage, with an expiry.
- There is no authentication anywhere. Nothing is exposed to a network.

## What the design promises

Two properties do not bend, at any stage:

**A human can always see, stop, and take over.** Every worker's state is
inspectable, and one action removes all authority from everything the system is
running.

**Revocation works immediately.** Authority is checked every time it is used and
never cached, so revoking a capability takes effect before the next action rather
than eventually.

If you find a way to break either of those, that is the most valuable report you
can send.

## What the design does not promise

Stated plainly, because a security document that claims full coverage is lying:

- **Prompt injection will sometimes succeed.** The goal is not to prevent it. The
  goal is that a successful injection produces one bounded, recorded action within
  already-granted authority, instead of a stolen credential and silent
  exfiltration.
- **Containers are not a boundary against a determined attacker.** Untrusted code
  needs a VM, and that is not built yet.
- **Compromising the control plane is total.** It holds the log, the authority
  checks, and the credentials. That is a deliberate single point of trust.

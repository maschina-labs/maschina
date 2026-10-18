---
title: Protocol and Architecture
subtitle: How the system is assembled, and why each boundary exists
author: Asher Wilson, Founder
email: asher@maschina.dev
date: October 2026
running: Protocol and Architecture
abstract: A technical description of Maschina for readers who intend to check the claims rather than accept them. Six services, each with one job and a boundary enforced by continuous integration rather than by convention. An append-only record fenced by lease epoch. A signing path in which the party that decides never holds a key. These papers describe the design and make no statement about what is live; that is published separately, dated, in the public change log.
---

## 1. Shape

Maschina is six services and a set of shared libraries. Every boundary described below is checked on
every commit, and a change that crosses one fails the build before a human sees it.

![Figure 1. The services and their boundaries. The dashed path is untrusted: nodes decide and propose, and hold nothing.](figures/fig-01-architecture.png)

The gateway is the public interface and the only service the application speaks to. The orchestrator
owns work and leases. The signer is the only service that can obtain a signature. The provisioner is the
only service that can create a wallet, and it cannot sign. Nodes run machines, dial outward, and never
touch the database. Bots reach owners on chat platforms, can stop their machines, and work only through
the gateway. Chain libraries exist in exactly one package.

## 2. Why the boundaries sit where they do

Each one removes a category of failure.

Nodes hold no keys, which is what makes a permissionless network safe rather than merely aspirational.
An untrusted node can propose something and have it refused, or it can stop working and lose its lease.
That is the entire surface available to it.

The provisioner creates wallets and cannot sign; the signer signs and cannot create wallets or alter
policies. The two use distinct provider credentials with distinct permissions, so the compromise of
either is survivable and neither is sufficient.

The gateway resolves the owner from the session and asks the database for "this owner's machine with
this identifier" in a single statement. Someone else's machine is not found, rather than refused with a
message confirming it exists.

Chain libraries live in one package, so an additional venue is an adapter, and a second chain, or a
deliberately fake chain used in tests, is a package rather than a rewrite.

## 3. The record

State is derived, never stored. Reading a machine's events in order produces its state, its budget and
its limits.

Two invariants are enforced at the one function that writes, because an invariant enforced in several
places is eventually enforced in none.

**Schema conformance.** Every event is validated against the schema for its type. An append-only record
cannot be corrected later, so an event written incorrectly is permanent.

**Lease fencing.** A write carries the epoch of the lease its author holds, and the comparison happens
inside the same statement as the insert.

![Figure 2. The record is append only and fenced. A writer from a superseded epoch is refused by the same statement that would have accepted it.](figures/fig-05-record.png)

Ordering is by acceptance time, then by identifier, and identifiers are time ordered so they never tie.

## 4. Lifecycle

Reading history is deliberately forgiving: an unusual sequence still produces an answer, because
refusing to interpret the past is not an option for a system that must start up and continue. Accepting
a change is strict: a transition is validated before anything is written, so the record only ever gains
changes that were permitted at the moment they occurred.

![Figure 3. The lifecycle. Every transition that exists is checked before it is recorded, and the one that does not exist is the one that would undo a stop.](figures/fig-03-lifecycle.png)

## 5. One action, end to end

![Figure 4. The path of a single action across services.](figures/fig-04-action-path.png)

The watcher observes a condition and queues work, once per crossing, with a hysteresis band so a price
resting on a level does not fire repeatedly and a minimum interval between runs.

A node claims the work, takes a lease and renews it. It reads balances, evaluates the machine's decision
function, obtains a quote, checks that quote against an independent price source, and proposes.

The orchestrator forwards the proposal only for work that node still holds. The signer applies the
mandate, reserves budget under a row lock, signs through the provider, and sends exactly once. Retries
reuse the same signature.

The true cost is read back from the chain, counting native and wrapped balances together and removing
fees, and the budget is settled against that number rather than the estimate. Every step is appended
with its reasoning.

## 6. Machine kinds

A machine kind is a deterministic decision function: settings, balances and history in, a proposed
action or nothing out.

It cannot execute, hold a key or contact a venue. Determinism is a security property rather than an
aesthetic preference, because a decision that can be recomputed from its inputs can be replayed and
checked by a stranger, which is what makes it possible to pay strangers to run machines they did not
write.

Settings are validated strictly. A missing or malformed setting is an error rather than a default,
because a default that silently permits something is the exact mechanism by which automated systems lose
money, and it is invisible until the day it is expensive.

## 7. Execution quality

Two numbers are recorded for every action: time from decision to landing, and the gap between the quoted
and the realised cost.

Both are designed to be published per machine. They are the difference between a strategy that works on paper and one
that works, and they are the metric the network exists to improve.

## 8. Interfaces

The public interface is described by a document generated from the route definitions rather than
maintained beside them, so it cannot drift.

Amounts are strings of digits in base units, never floating point. Times are ISO 8601 in UTC. An unset
limit is absent rather than zero, because zero and unset mean opposite things. Errors carry a stable
code, a human readable message and a request identifier.

## 9. Operations

Services run as containers. The host exposes no ports to the internet and the public interface is
reachable only through an outbound tunnel, so nothing is listening and no certificate is ever renewed on
the machine. The database is unreachable from outside the host. Backups are taken nightly and encrypted
with a key held elsewhere.

Releases build images pinned by digest, each carrying signed provenance and a software bill of
materials, and deployment happens only after those images exist.

## 10. Testing

Behaviour is written alongside the tests that prove it. Integration tests run against real
PostgreSQL and, where chain behaviour matters, real chain endpoints rather than mocks, because the failures worth catching are the ones
mocks cannot produce: concurrency, ordering, partial failure, and the gap between an estimate and
reality.

Concurrency is tested against a real database rather than argued: actions racing for a budget cannot
spend more than it holds.

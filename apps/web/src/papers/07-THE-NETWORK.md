---
title: The Network
subtitle: Whose computers this runs on, what they earn, and why distance is the number that matters
author: Asher Wilson, Founder
email: asher@maschina.dev
date: October 2026
running: The Network
abstract: Machines need somewhere to run, and that somewhere does not have to belong to Maschina. This document describes the contributed network: why it can be permissionless, how work is claimed and verified, what it sells, and the one performance claim Maschina is willing to make, which is not that it makes the chain faster. It describes the design of a network built in stages; what exists is published in the change log.
---

## 1. The premise

The network is the set of computers, servers and devices that perform the work. They belong to the
people who run them, they earn for the capacity they provide, and joining requires no permission.

That last part is usually where such systems become unsafe. It is not unsafe here, and the reason is
structural rather than procedural.

## 2. Why this can be opened to anyone

A node holds no keys.

It reads balances, evaluates a machine's decision function, obtains a quote, checks that quote against
an independent price source, and proposes an action. The proposal then passes the mandate, the ledger
and the wallet policy, none of which the node can influence.

![Figure 1. Nodes may be anyone, because nodes hold nothing.](figures/fig-09-network.png)

The worst a hostile node can do is propose something that is refused, or stop working and lose its lease
to another node. That is the entire attack surface available to it. Untrusted machine code is isolated
separately, with access only to what it was given: no ambient network, no ambient filesystem, no reach
into the host or into other machines running beside it.

Compare this with the ordinary arrangement, where the thing making decisions holds the key that moves
the money. Roughly forty percent of stolen funds in this industry come from somebody obtaining such a
key [2]. A network of strangers running that arrangement would be indefensible. A network of strangers
running this one is merely a scheduling problem.

## 3. Work, claims and leases

Work is queued centrally and claimed by nodes. A claiming node holds a lease and renews it while
working. A node that stops renewing loses the lease, and the work is reassigned.

Reassignment is safe because the record is fenced: a node whose lease has passed to another cannot
append afterwards, and the check happens in the same statement as the write, so two nodes racing cannot
both succeed. A partition, a crash or a slow machine costs time, never correctness.

## 4. Proof that the work happened

Paying strangers requires knowing the work was done.

Machine decisions are deterministic: the same settings, balances and history produce the same decision.
A run can therefore be replayed by anyone, including by another node, and compared against what was
reported. A node that reports a decision its inputs do not produce is detectable without trusting
anybody.

Payment follows verification rather than assertion, and a node's standing moves on the difference
between the two.

## 5. Distance

In trading, the distance between deciding and landing is a cost paid on every action.

Maschina does not claim to make Solana faster. That is not a claim a third party can make about a chain,
and the projects that have made real progress on the surrounding problem have done it by improving the
path rather than the protocol [6].

What is achievable, and worth building a network around, is shorter distance. Execution physically close
to where blocks are produced. Endpoints close to the machines that query them. Enough geographic spread
that no participant is far from capacity.

Every action records its time from decision to landing. The number is designed to be published per machine and in
aggregate, which turns a marketing claim into a measurement that can be checked and, if we are wrong,
used against us.

## 6. What the network sells

**Execution**, which is the work of running machines. **Compute**, being processor time, memory and
graphics capacity, sold to whoever needs it with machines as the first customers. **Bandwidth and
presence**, capacity close to where it is needed.

Contributors set what they offer. Scheduling is a market rather than a queue: work goes to the node that
is near enough, fast enough and trusted enough.

## 7. Standing and stake

Nodes accumulate standing from verified work, uptime and honest reporting, and lose it for the reverse.
Standing determines the work a node is offered and the rate it earns.

Because standing can be abandoned by starting again under a new identity, it is backed by a stake that
cannot be. A node that reports work it did not perform loses the stake rather than merely the
reputation. Reputation without collateral is a costume.

## 8. Devices

Not every contributor owns a server. Smaller devices contribute presence, bandwidth and light work
rather than heavy computation, which makes the network denser where users actually are. Density near
users is what shortens distance, and shortening distance is the entire point.

## 9. What operators earn

Operators are paid for verified work at rates set by scheduling. Maschina takes a share of what the
network earns rather than charging operators to participate.

The incentive is deliberately boring. Contribute capacity, do the work, prove it, get paid. There is no
mechanism by which an operator earns more by behaving worse, because payment follows verification and
verification is not a matter of opinion.

## References

[2] Chainalysis and industry incident analyses, 2025 and 2026, on the share of stolen funds attributable
to private key compromise.

[6] A. Federa, A. McConnell and M. Ward. *DoubleZero Protocol,* December 2024, on improving the path
between distributed systems rather than the systems themselves.

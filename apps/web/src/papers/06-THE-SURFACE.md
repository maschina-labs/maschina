---
title: The Surface
subtitle: Everything a machine can do with money, and why breadth is a safety argument
author: Asher Wilson, Founder
email: asher@maschina.dev
date: October 2026
running: The Surface
abstract: Trading is the first job machines do on Maschina, not the definition of what they do. This document describes the full surface: execution, positions, yield, leverage, issuance and prediction, how capability is added without weakening any guarantee, and why access is earned rather than acknowledged. It describes the design; what is live is published in the change log.
---

## 1. Why breadth is the point

Someone who wants their money working does not want five applications with one feature each. They want
one place where the work happens. In this market that preference is unusually strong, and it is not
irrational.

It is also a safety argument, which is the part usually missed. Every capability added to Maschina
inherits the same custody, the same budget, the same mandate and the same record. A person using six
capabilities here has one set of limits to understand and one record to read. The same person using six
applications has six keys exposed, six sets of limits enforced by six different parties, and no common
account of what happened.

Consolidation of surface is consolidation of risk only when the surface is unsafe. When the surface is
built on one enforced custody layer, consolidation is the safest thing available.

## 2. Execution

Everything else resolves into these.

**Immediate exchange**, routed across venues, with the received quote checked against an independent
price before acceptance.

**Scheduled execution**, at an interval, for an amount.

**Triggered execution**, when a price crosses a level, once per crossing, with a hysteresis band so a
price resting on the level does not fire repeatedly.

**Worked execution**, dividing a larger order across time or volume to reduce its own impact.

**Resting orders**, waiting at a price rather than acting at market.

Every one of these records the time from decision to landing and the difference between quoted and
realised cost, and both are designed to be published. Execution quality is a claim that can be measured, so it is
measured.

## 3. Positions

**Take profit and stop loss.** A machine holds a position and closes it, in part or entirely, at a gain
or a loss threshold. This is the first capability that closes what it opened, and it is the difference
between a machine that buys and a machine that trades.

**Ranges.** A band with two edges, bought low and sold high, repeatedly, with a minimum interval between
actions and hysteresis at each edge.

**Rebalancing.** Target weights held within a drift tolerance.

**Copying.** Mirroring another machine or wallet, with the copier's own limits applied rather than the
original's, so a published strategy can never carry its author's risk appetite into somebody else's
account.

## 4. Yield

Money between actions is idle money, and idle money is a cost.

Staking, including the choice of where. Lending of balances not currently needed. Liquidity provision in
a defined range with fees harvested and impermanent loss reported honestly rather than omitted. And idle
routing, where unspent budget earns in the safest venue its owner approved and unwinds the moment the
machine needs it.

Idle routing applies to every machine regardless of its job, which makes it the quietest and most
broadly useful capability in this document.

## 5. Leverage and derivatives

Available only within limits an owner sets explicitly, never by default.

Perpetual futures, with leverage expressed as a per-machine ceiling and a mandatory distance from
liquidation the machine may not cross. Options, beginning with covered calls and cash secured puts,
which are the two an owner can actually reason about. Basis and pair trades, holding an asset against a
short position to isolate a funding rate rather than a direction.

## 6. Issuance and markets

**New issues**, acquiring newly created assets that pass the mandatory checks described in document 09,
with a managed exit rather than an indefinite hold.

**Token issuance**, through a curve whose rules make the ordinary exit impossible. One capability among
many rather than a product of its own.

**Prediction markets**, positions on outcomes rather than prices, with resolution risk stated plainly
and availability determined by jurisdiction.

## 7. Assets

Any asset reachable on Solana, including representations of assets issued elsewhere, subject to the
mandatory checks and the owner's approved list. An asset the owner has not approved is refused by the
wallet itself rather than by a preference setting, which is the difference between a rule and a
suggestion.

## 8. How capability is added without adding risk

One execution interface, many adapters. A machine kind never speaks to a venue; it proposes, and the
platform routes.

This is why the list above can grow without the guarantees weakening. A new venue is an adapter behind
the same mandate, the same ledger and the same policy. A capability that cannot be expressed that way
does not get built, regardless of how attractive it looks, because the alternative is a platform whose
guarantees are true of most of it.

## 9. Earned access

Capability is unlocked by demonstrated competence rather than by acknowledging a warning.

A new owner begins in simulation, with major assets and small limits. Real funds, then long tail assets,
then leverage and derivatives are unlocked as the record shows an owner understands what they are
operating.

This is a risk control wearing the clothes of progression, and both halves are honest. Nobody resents a
capability they can earn. Everybody resents a dialog asking them to confirm they accept consequences
they have not yet experienced.

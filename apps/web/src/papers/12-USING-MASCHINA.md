---
title: Using Maschina
subtitle: For owners and traders: creating a machine, funding it, reading it, stopping it
author: Asher Wilson, Founder
email: asher@maschina.dev
date: October 2026
running: Using Maschina
abstract: A practical guide for the person whose money this is. What you are actually doing when you create a machine, which limits matter most, how to read a record, how to stop something, and how to start in a way you will not regret. What is live at any moment is published in the change log.
---

## 1. What you are actually doing

You create a machine, give it a job, fund it, and set what it may do. It does that work, records
everything, and pays you what it makes. You can pause it, stop it, tighten its limits or read its
history at any moment.

You are the owner. It is the worker. Its money comes from you, and the limits on what it may do with it are enforced by a party that knows nothing about us.

## 2. Creating one

**Choose the job.** Each kind does one thing. Buy on a schedule. Act when a price crosses a level. Hold
a position and close it at a threshold. Work a range. Hold a portfolio at target weights.

**Set the terms.** Which assets it may touch, the most it may spend in total, per action and per day,
and when it may act.

**Create it.** A wallet is created, a policy is written onto it, and that policy is read back and
verified before your machine exists. If anything fails to match, nothing is created.

**Fund it.** Send funds from your own wallet to the machine's address. Send a small amount first and
confirm it arrived before sending the rest. This costs you five minutes and has saved people a great
deal more than that.

**Start it.** From that moment it acts inside its limits.

Funding and budget are different things. Funding puts assets in the wallet. The budget is permission to
spend them, and it lives in the record. A machine holding a thousand with a budget of fifty may spend
fifty.

## 3. The limits worth thinking about

**Total budget.** The most it can ever spend.

**Per action.** The largest single trade.

**Per day.** The most in twenty four hours. Set this lower than feels necessary. It is the limit that
protects you when a strategy meets a market it was not designed for, which will happen.

**Approved assets.** Anything not approved is refused by the wallet itself, not by a setting.

**Window.** The hours it may act.

A limit you did not set is not permission. A machine missing a required limit does not start.

## 4. Reading the record

Every machine keeps a complete history: each decision, the reasoning, and the result. For a trade that
means what was exchanged, at what price, against which independent price the quote was checked, what it
truly cost after fees, and how long it took from decision to landing.

Beside it, always, is the benchmark: what simply holding would have done over the same period. Most
automated trading underperforms that benchmark [3][4]. You should be able to see immediately whether
yours does, and we would rather you find out from us than from your own bank balance six months later.

## 5. Control

**Pause** stops action and keeps everything. Reversible.

**Stop** is permanent. A machine that could restart itself is a machine you cannot switch off, so that
transition does not exist. Create a new one instead.

**Stop everything** halts every machine you own at once.

**Tighten limits** at any time, effective on the next action.

## 6. Getting your money out

Withdrawing sends funds back to a wallet you own, and we never hold them in between.

The design goal is that you can recover funds directly from the key management provider, without us and
without us continuing to exist. Document 04 describes it.

## 7. Starting in a way you will not regret

Begin in simulation: live prices, real decisions, nothing at risk. With real funds, begin with an amount
whose total loss would not change your week. Run one machine before running five, and read its record
daily for the first week.

Prefer a machine you can explain in one sentence to one you cannot. Treat any strategy that appears
unable to lose as a strategy you do not yet understand.

## 8. What this does not do

It does not predict prices. It does not give advice. It does not promise returns, and nobody here will
ever tell you what a machine is likely to make.

What it guarantees is narrower and worth considerably more: a machine cannot spend beyond what you
allowed, cannot touch programs or assets outside its wallet policy, and cannot hide
what it did.

## 9. Fees

Charged on work performed, never on profits, and shown before a machine starts. Faster execution paths
cost more than scheduled ones. Rates are on the pricing page.

## 10. Where to go

Documentation at `docs.maschina.dev`. Service status at `status.maschina.dev`. Security reports through
`maschina.dev/.well-known/security.txt`.

## References

[3] F. Chague, R. De-Losso and B. Giovannetti. *Day Trading for a Living?* SSRN 3423101.

[4] B. Barber and T. Odean. *Trading Is Hazardous to Your Wealth,* and subsequent work.

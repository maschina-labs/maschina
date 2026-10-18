---
title: The Machine
subtitle: The unit of the system, what it holds, and how it lives and dies
author: Asher Wilson, Founder
email: asher@maschina.dev
date: October 2026
running: The Machine
abstract: Everything in Maschina is either something a machine does, somewhere a machine runs, or something built from what machines leave behind. This document describes the unit itself: the five things every machine has, how it decides, how it is bounded, what its owner sees, and why a stopped machine can never start again.
---

## 1. What a machine is

A machine is software with a job, a wallet, a budget, a mandate and a history. It belongs to exactly one
owner. It does the work it was given and no other work, and it writes down everything it does.

The relationship is worth stating plainly, because the industry usually obscures it. The owner funds.
The machine spends. Everything the machine holds returns to the owner. There is no third party in that
sentence, and that includes us.

## 2. The five things

**A job.** One thing, done well. Machines are narrow deliberately, because a narrow machine can be
reasoned about, tested, compared against others doing the same job, and understood by its owner at a
glance. A machine that does nine things cannot be evaluated at all.

**A wallet.** Its own, created for it, with a policy enforced by the provider. Not a subaccount, not an
allowance against the owner's wallet. Its funds are physically separate from every other machine's,
which means one machine's failure is one machine's failure.

**A budget.** What it may spend, reserved before each action and settled afterwards at true cost. This
is separate from what its wallet holds, and the distinction is load bearing: funding a wallet is a
transfer, while granting a budget is permission. A machine holding a million dollars with a budget of
fifty may spend fifty.

**A mandate.** Which assets, how much per action, how much per day, how much in total, and when.

**A history.** Every decision, the reasoning, and the result, permanently.

## 3. The life of a machine

![Figure 1. The life of a machine. One transition is deliberately absent.](figures/fig-03-lifecycle.png)

A machine in draft exists and has no permission. Ready means funded with a budget. Running means acting.
Paused keeps everything and stops acting. Stopped is final.

Stopped is final because the alternative is a machine that can restart itself, and a machine that can
restart itself is a machine its owner cannot switch off. An owner who wants the work to continue creates
a new machine, which begins a new record, which is the honest thing for a track record to do.

## 4. How a machine decides

A machine kind is a deterministic function. Given its settings, its balances and its record, it returns
the action it believes should happen now, or nothing at all.

It cannot execute. It cannot reach a key. It cannot call a venue. It proposes, and the proposal is
checked by the mandate, the ledger and the wallet policy, any of which refuses it alone.

This is why a machine kind does not need to be careful with money. It cannot reach any.

## 5. Kinds

The kinds below describe the design. Which of them exist at any moment is published in the change log.

| Kind | The job it does |
| --- | --- |
| Scheduled buy | Acquire a fixed amount at a fixed interval |
| Price trigger | Act when a price crosses a level, once per crossing |
| Take profit | Hold a position and close it at a gain or loss threshold |
| Range | Buy the lower edge of a band, sell the upper edge, repeat |
| Rebalance | Hold a portfolio at target weights within a drift tolerance |
| Liquidity | Provide liquidity in a range and harvest the fees |
| Staking | Put idle balances to work, and choose where |
| New issue | Acquire newly issued assets that pass mandatory checks, and manage the exit |
| Copy | Mirror another machine or wallet, under the copier's own limits |

Kinds are added over time and every one inherits the same guarantees. A new kind cannot introduce a new
way to lose money beyond its own budget, because no kind controls the money.

## 6. Settings, and why they are strict

A setting that is missing, malformed or out of range is an error. It is never quietly replaced with a
default.

This is not pedantry. A default that silently permits something is precisely how automated systems lose
money, and it is invisible until the day it is not. A machine that refuses to start because its daily
cap was never stated has behaved correctly, and the mild irritation of that moment is the cheapest
lesson the system will ever teach.

## 7. What an owner sees

For the machine: its state and the reason for it, its wallet address, budget granted, reserved, settled
and available, its limits, what it may do right now, and its complete record.

For each action: what was exchanged, at what price, against which independent price the quote was
checked, what it truly cost after fees, how long it took from decision to landing, and the reasoning
behind the decision.

A machine's page is a statement of account its owner can hand to anybody.

## 8. Benchmarks

Every machine is measured against doing nothing at all. Holding the asset, holding cash, and the
machine's own result, over the same period, net of fees, displayed together.

The academic literature on active trading is unambiguous and unkind. Ninety seven percent of persistent
day traders in the largest study of the question lost money net of fees [3], and the most active traders
in a long study of brokerage accounts underperformed the market by more than six points a year [4]. A
system that hides this comparison is a system that will eventually be caught hiding it. Showing it turns
the most uncomfortable number on the page into the most credible one.

## 9. Teams

Machines delegate. One machine may hand a portion of its budget to another under limits always tighter
than its own, never looser, and the delegation is recorded on both sides.

![Figure 2. A delegated budget is always narrower than the budget it came from.](figures/fig-08-delegation.png)

This is how a portfolio becomes a structure rather than a list. One machine allocates according to
conditions, others execute, and the record shows exactly which decision belonged to which, which is
something no human managed portfolio can produce.

## 10. Death, and why it stays visible

A machine that exhausts its budget stops permanently, and its record is designed to stay public.

This matters more than it appears to. A track record only means something when the machines that failed
are still visible beside the ones that worked. A system that quietly removes its failures produces a
leaderboard of survivors and presents it as evidence, which is the oldest dishonesty in finance and one
of the easiest to avoid.

## References

[3] F. Chague, R. De-Losso and B. Giovannetti. *Day Trading for a Living?* SSRN 3423101.

[4] B. Barber and T. Odean. *Trading Is Hazardous to Your Wealth,* and subsequent work on the Taiwan
Stock Exchange.

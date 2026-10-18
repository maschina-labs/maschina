---
title: Maschina
subtitle: Letting software hold money, do real work, and be held to account for all of it
author: Asher Wilson, Founder
email: asher@maschina.dev
date: October 2026
running: Maschina: a custody and execution layer for software that holds money
disclaimer: Nothing in this paper is an offer to sell or a solicitation of an offer to buy any security, token or financial instrument, and nothing in it is investment, financial, legal or tax advice. Maschina does not take custody of user assets, does not manage funds on behalf of users, and does not promise returns of any kind. Statements about future capability describe intent and may change. These papers describe the design and make no statement about which capabilities are live at any moment; that is published separately, dated, in the public change log. Third party figures are attributed and are the work of their authors, not of Maschina. Full disclosures accompany this paper as document 14.
abstract: Software can decide what to do with money competently enough to be useful. It cannot be trusted to hold money, because every system in common use places the limits on that software inside the software itself, where one defect or one stolen credential removes them all at once. Maschina moves every limit outside the executing code. A machine holds funds in a wallet whose policy is enforced by a provider that knows nothing about Maschina's budgets or rules, and permits only approved programs, assets and recipients. Spending is governed by a ledger that settles against the true cost read back from the chain, actions are checked by rules that hold no key and cannot sign, and the work is performed by nodes that never hold a private key. Every decision and its reasoning is appended to a record that can only be added to. What emerges is a unit that can be funded, instructed and left alone.
---

## 1. Introduction

There is a gap in the middle of every conversation about software that acts on its own, and it is not a
gap in capability.

Software can read a market, weigh a decision and execute faster than any person. What it cannot do is be
given money. Not because it would spend it foolishly, though it might, but because the arrangement that
is supposed to stop it spending everything is an arrangement it administers itself.

Look at how an automated trader is actually assembled. It holds a private key, or holds a session that
can reach one. Its limits sit in its own configuration, read by its own code, enforced at its own
discretion. When people say such a system is "bounded", what they mean is that it has agreed to be. The
bound and the bounded party are the same party.

That arrangement survives ordinary conditions and fails under exactly the conditions that make bounds
necessary: an unexpected market, a defect nobody found, an instruction that means something different
than intended, a dependency that was replaced last Tuesday, a key copied from a laptop. And when it
fails it fails completely, because there is nothing underneath it. The money leaves and the chain does
not offer refunds.

The scale of this is measurable. Chainalysis attributes roughly seventeen billion dollars of losses to
scams and fraud in 2025, with a further three point four billion stolen outright [1]. Private key
compromise, rather than any flaw in a protocol or a contract, accounts for around forty percent of the
stolen total [2]. The dominant failure in this industry is not that the logic was wrong. It is that
something held a key and should not have.

Meanwhile the rails for software to spend money are being laid at speed. The x402 payment standard put
Visa, Stripe, Google, AWS, Coinbase, Circle, Mastercard and the Solana Foundation into a single
foundation in April 2026 [8], and, as of 2026, Solana settles somewhere between a half and two thirds of all
traffic on that protocol [7]. The industry is busy making it easy for software to pay for things. It has
not been nearly as busy making it safe.

That gap is what this paper is about.

## 2. The thesis

The scarce resource in a machine economy is not intelligence, strategy or compute. All three are
abundant, and cheaper every quarter. The scarce resource is delegated trust: the ability to hand money
to software and then stop watching it.

Whatever provides that becomes infrastructure, because everything else has to pass through it. A
strategy is worth something to the person who wrote it. A custody layer that makes any strategy safe to
run is worth something to everyone who will ever write one.

So Maschina is built in an order that looks backwards from outside. Custody first, capability second.
For a period that produces a system with every guarantee and very few tricks, which is an uncomfortable
thing to demonstrate. It is still the correct order, because capability added to a trustworthy
foundation is engineering, while trust added to a capable system is a rewrite.

## 3. Design principles

Six commitments govern every decision in the system. They are stated here because most of the paper is
their consequences.

**Limits live where the limited party cannot reach them.** Anything a machine enforces about itself is
documentation. Only what the wallet provider, the ledger or the rule engine enforces is a limit.

**Absence is never permission.** A machine with no daily cap has no permission to trade, rather than
unlimited permission to trade. Every system that has ever lost money to a default disagreed with this.

**The record is permanent.** State is not stored and updated. It is derived from an ordered, append-only
sequence of events that no part of the system can rewrite, including us.

**Refusal is cheap and reversal is impossible.** Every check happens before the signature, because on a
public chain there is no afterwards.

**Funds go only where the policy says.** Money enters a machine from its owner and leaves it only to the
programs, assets and recipients its policy names, and that restriction is enforced outside our software.

**Nothing is trusted because it is ours.** Our servers, our code and our operators are treated as
potentially compromised, and the guarantees are written so that assumption costs a user nothing.

## 4. The machine

The unit of the system is a machine: software with a job, a wallet, a budget, a mandate and a history.

Its **wallet** is created for it at a key management provider. Neither the owner nor Maschina
holds the key, and export is denied by policy. Creation is ordered and verified: the wallet is
created, a policy is written onto it, and that policy is read back and compared against what was
requested. If it does not match, no machine is created. A funded wallet with nothing holding it is a
state this system cannot enter.

Its **policy** names the assets it may hold, the programs it may call, and the recipients it may
send funds to. The provider enforces this and knows nothing of the machine's budget or rules.

Its **budget** is what its owner permits it to spend. Funds are reserved before an action and settled
afterwards against the true cost, read back from the chain, with fees and wrapped balances accounted
for, inside one database transaction holding a lock on that machine.

Its **mandate** is what its actions are checked against: that it is running, inside its window, touching
only approved assets, and sized within the per-action, daily and total caps.

Its **record** is everything it did and the reasoning behind each decision.

![Figure 1. The services, and the boundaries enforced between them. Each boundary removes a class of failure rather than organising code.](figures/fig-01-architecture.png)

## 5. Custody, and the three refusals

Money moves only when three independent systems agree. Any one of them refuses alone.

The **mandate** is checked by a rule engine that is pure logic: it holds no key, performs no I/O and cannot sign. The **budget** is held by a ledger under a row
lock, and settled against reality rather than against an estimate. The **policy** is enforced by the
provider, outside our infrastructure entirely.

![Figure 2. Three independent checks stand between a decision and a signature. The third is enforced by the wallet provider, outside our infrastructure.](figures/fig-02-refusals.png)

The third is the load-bearing one. Even if the signer were compromised, the wallet provider would refuse
anything outside the programs, assets and recipients the policy names. The credential that writes
policy is held apart from the one that signs, so that compromising the signer does not also change the
rules it is held to.

Powers are separated for the same reason. The credential that creates wallets cannot sign. The
credential that signs cannot create wallets or alter policies. Nodes hold no credential at all. This
mirrors what the better agent wallet providers have converged on, which is a policy engine gating every
signature against the principal's rules [9], with one difference that matters: in Maschina the party
being gated never holds the key in the first place.

## 6. The record

Everything a machine is gets derived by reading its events in order.

Two properties are enforced at the single function that writes, because anything enforced in two places
is eventually enforced in none. Every event is validated against the schema for its type, since an
append-only record cannot be corrected afterwards. And every write carries the lease epoch of its
author, compared in the same statement that performs the insert, so a node whose work was reassigned
cannot append afterwards and two nodes racing cannot both succeed.

![Figure 3. The record is append only and fenced by lease. The epoch check and the insert are a single statement, so a reassigned node cannot write history.](figures/fig-05-record.png)

This is not bookkeeping. It is what makes everything in Section 9 possible, because a history that
cannot be edited is a history that can be believed by someone who does not know you.

## 7. Execution

Work is scheduled centrally and performed by nodes. A node claims work, holds a lease and renews it
while working. A node that goes quiet loses the lease and the work is reassigned.

A node reads balances, evaluates the machine's decision, obtains a quote, checks that quote against an
independent price source, and proposes. It never executes. The proposal travels to the signer, which
applies the mandate, reserves budget, signs, and sends exactly once. Retries reuse the same signature
rather than creating a second transaction, so a network failure at the wrong moment cannot produce a
duplicate trade.

![Figure 4. One action, from condition to permanent record. The node decides and proposes; it never signs.](figures/fig-04-action-path.png)

Two numbers are recorded for every action: the time from decision to landing, and the difference between
the quoted and the realised cost. They are the honest measure of execution quality, and they are
designed to be published per machine, because a system that does not publish them is asking to be taken on faith.

## 8. The life of a machine

A machine moves from draft to ready when it is funded, to running when it is started, and between
running and paused as its owner decides. Stopped is terminal.

![Figure 5. The life of a machine. Stopped is final, because a machine that can restart itself is a machine its owner cannot switch off.](figures/fig-03-lifecycle.png)

That last transition is missing on purpose. An owner who stops a machine has made a decision, and a
system that lets the stopped thing quietly resume has taken that decision back.

## 9. What is built on top

The custody layer is not the product. It is what makes the product possible, and the product is
everything in this section.

![Figure 6. Each layer exists because of the one beneath it. Nothing is built that does not reuse the spine.](figures/fig-06-layers.png)

**The surface.** Trading first, because it is the hardest test of the guarantees. Then scheduled and
triggered execution, positions that close themselves, ranges worked repeatedly, portfolio rebalancing,
liquidity provision, lending, staking, yield on idle balances, and in time prediction markets and token
issuance. Breadth is deliberate: a person who wants their money working does not want five applications,
they want one place where the work happens, with one set of limits to understand.

**The network.** The computers that run machines belong to other people, who earn for providing them.
Because nodes hold no keys, the network grows without anyone extending trust to whoever joins it. As it
spreads geographically the distance between a decision and a landed transaction shortens. Solana's own design already targets throughput and latency [5], and the projects that have made progress
on the surrounding path have done it by improving the path rather than the protocol [6]. We do not
claim to make Solana faster. We claim the shortest path from decision to settlement, and we will publish the
number.

**The economy.** Machines delegating budget under limits tighter than their own, paying for data and
compute, selling what they produce, insuring each other against drawdown, and competing in public with
their records as the referee.

**Credit, and what follows from it.** Every machine accumulates a signed, verifiable history of what it
did, earned, lost, and how it behaved under stress. That is a credit file. Once credit files exist,
capital can be allocated to machines on evidence rather than on promises, which is a market that cannot
exist anywhere the history can be edited.

## 10. Integrity

A system where software holds money attracts people who would like to take it, and the most common
method is not sophisticated. An asset is created, bought by people who believe in it, and emptied by the
person who created it. Chainalysis flagged more than sixty percent of meme coins launched in 2025 as
potential rug pulls within thirty days of creation [1].

Warning people does not work. Three mechanisms do.

**Mandatory asset checks**, which cannot be switched off, only tightened. Authorities that permit
printing, freezing or seizure. Liquidity that can be withdrawn. Ownership concentrated in a few
addresses. A simulated sale against the real route, because an asset that cannot be sold in simulation
is not acquired. Monitoring continues after purchase, since the events that cost people money happen
after they have bought.

**Standing computed from outcomes**, never from opinions, because anything decided by vote is farmed
within a week. Standing earns lower fees, higher limits and better placement, and losing it costs the
same things. Because standing can be abandoned by starting over, the activities that matter require a
bond that cannot be.

**Issuance in which the issuer is paid last.** Assets issued through Maschina are to be minted without the
authorities that permit printing, freezing or seizure, with liquidity owned by the program rather than
the issuer. The issuer's own allocation is custodied by the program, unlocks against time and
milestones, and on an early exit returns their cost basis and nothing more. The remainder is added to
the reserve, which raises the floor for everyone still holding.

![Figure 7. The share of an issuer's gain returned to the reserve, by days since issuance (an illustrative schedule). The issuer is not prevented from earning. The issuer is paid last.](figures/fig-07-issuance.png)

Two honest limits. An issuer can distribute holdings across addresses before issuance and sell from
those; addresses funded by the issuer at or before issuance inherit the same rules, and concentration is
detectable, but no design closes this completely. And an issuer who can never realise a gain will not
issue at all, which is why the confiscation decays rather than standing as a wall.

## 11. Economics

Maschina earns from work performed, never from outcomes promised.

Fees apply to execution and are shown before a machine starts, with faster paths priced above scheduled
ones. A share of the fee on a copied machine goes to its creator. Maschina never takes a share of profits.
In time, plans may trade a monthly price for lower fees, the network takes a share of what it sells, and
payments between machines carry a fee.

The distinction matters more than it sounds. No strategy is guaranteed to work. The academic record on
retail trading is brutal and consistent: of nearly twenty thousand Brazilian day traders studied over
four years, ninety seven percent of those who persisted lost money net of fees, and fewer than one in a
hundred earned more than a bank teller [3]. Barber and Odean found the most active traders
underperforming the market by six and a half points a year, and a fifteen year study of Taiwanese day
traders found under one percent reliably profitable [4].

A business that only earns when its users profit will eventually need its users to believe they are
profiting. That pressure produces every dishonest practice this industry is known for. Maschina charges
for work, so it never acquires that incentive, and every result is displayed beside the benchmark of
having done nothing at all.

Maschina has no token. If one is ever issued it will buy compute, priority and fee discounts rather than
represent a share of profits, and it will follow real usage rather than precede it. Maschina will not
operate its own chain.

## 12. Conclusion

The distance between what software can decide and what software can be trusted to hold is the whole
opportunity, and it is architectural. Closing it means putting every limit somewhere the limited party
cannot reach, accepting the constraints that follow, and proving the result with a history nobody can
edit.

Everything else described here, the surface, the network, the economy and the markets that become
possible once behaviour is provable, rests on getting that one thing right first. That is the order this
was built in, and it is the reason the guarantees in this paper are properties of the system rather than
promises from its author.

## References

[1] Chainalysis. *The 2026 Crypto Crime Report.* Reports approximately $17 billion lost to scams and
fraud and $3.4 billion stolen in 2025, an average rug pull of roughly $510,000, and over 62% of meme
coins launched in 2025 flagged as potential rug pulls within 30 days.

[2] Chainalysis and industry incident analyses, 2025 and 2026. Attribute approximately 40% of stolen
funds to private key compromise rather than protocol or contract defects, rising to 43.8% in 2024.

[3] F. Chague, R. De-Losso and B. Giovannetti. *Day Trading for a Living?* SSRN 3423101. Of 19,646
Brazilian futures day traders studied between 2013 and 2017, 97% of those who persisted beyond 300
trading days lost money net of fees.

[4] B. Barber and T. Odean. *Trading Is Hazardous to Your Wealth,* and subsequent work on the Taiwan
Stock Exchange. The most active traders returned 11.4% annually against a market return of 17.9%; under
1% of day traders were reliably profitable after fees.

[5] A. Yakovenko. *Solana: A new architecture for a high performance blockchain,* 2017.

[6] A. Federa, A. McConnell and M. Ward. *DoubleZero Protocol,* December 2024.

[7] Solana Foundation and PYMNTS reporting, 2026. Since the launch of x402 on Solana, over 35 million
transactions and $10 million in volume have settled over the protocol, with Solana handling an estimated
49% to 65% of all x402 payments. Independent analysis suggests only a small fraction of that value was
genuinely agent-originated at the time of writing.

[8] The Linux Foundation. *x402 Foundation announcement,* April 2, 2026, with initial support including
Adyen, AWS, American Express, Base, Circle, Cloudflare, Coinbase, Google, Mastercard, Microsoft,
Shopify, the Solana Foundation, Stripe and Visa.

[9] Coinbase AgentKit, Crossmint, Privy and Turnkey. Embedded wallet providers offering policy engines
that gate signatures against a principal's rules.

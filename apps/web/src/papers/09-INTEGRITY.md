---
title: Integrity
subtitle: Asset safety, standing, and a market where the issuer is paid last
author: Asher Wilson, Founder
email: asher@maschina.dev
date: October 2026
running: Integrity
abstract: A system where software holds money attracts people who would like to take it, and the most common method is not sophisticated. Over sixty percent of meme coins launched in 2025 were flagged as potential rug pulls within thirty days. This document describes three mechanisms that make the usual methods difficult, the attacks each one must survive, and why they work better together than separately. It describes the design; what is live is published in the change log.
---

## 1. The problem, stated honestly

Most losses in this market are not clever. An asset is created, bought by people who believe it has a
future, and emptied by the person who created it. The mechanics are well understood and they repeat
weekly.

The numbers are not marginal. Chainalysis flagged more than sixty two percent of meme coins launched in
2025 as potential rug pulls within thirty days of creation, with roughly seventeen billion dollars lost
to scams and fraud across the year and an average rug pull of around half a million dollars [1].

Warning people does not work. Requiring an acknowledgement does not work. What works is making the
profitable version of the behaviour impossible to perform.

## 2. Mandatory asset checks

Every asset a machine touches is checked before acquisition. The checks cannot be switched off. An owner
may make them stricter and may never make them looser.

**Before acquiring:** authorities that should not exist, being the ability to create more, to freeze
holders, to seize balances, or to run arbitrary code when the asset moves. How much liquidity exists and
whether it can be withdrawn by whoever placed it. How much is held by the largest holders and by the
issuer. Whether the issuing address has created assets that went to zero. And a simulated sale executed
against the real route, because an asset that cannot be sold in simulation is not acquired.

That last check alone removes most of the category, and it costs nothing but a simulation.

**After acquiring, continuously:** liquidity thinning or being removed, an authority reappearing,
concentration shifting, the issuer's balance moving, the simulated sale beginning to fail. Any of these
triggers an automatic exit, executed as a normal action within the machine's normal limits.

The second half matters more than the first. Checking once at purchase is a snapshot. The events that
cost people money happen afterwards, which is precisely when most tools stop looking.

## 3. Standing

Every participant has standing, computed from outcomes in the record rather than from opinions. It is
visible, it has consequences, and it is what gives the other two mechanisms teeth.

**Standing rises with** assets issued that still have liquidity and holders months later, machines
published that behave in other people's hands as they did in their author's, verified work delivered,
disputes settled honestly, and time, which is the cheapest honest signal available.

**Standing falls with** attempted exits caught by the issuance rules, liquidity withdrawn, authorities
reinstated, assets issued that cannot be sold, trading against oneself to manufacture activity, and
upheld reports from other participants.

**Standing buys** lower fees, higher limits, scheduling priority, better placement, and the ability to
issue or publish against a smaller bond. Losing it costs the same things in order, ending with removal.

Three properties keep this from becoming decoration.

**It is computed, not voted.** Anything decided by opinion is farmed within a week. Reports open a case;
they do not move the number by themselves.

**It is bonded.** Standing that can be abandoned by starting over is worth nothing, so the activities
that matter require a stake that cannot be abandoned. Reputation is backed by money or it is theatre.

**It is explained.** Every change names its reason and links its evidence, and an appeal is read by a
person. A system that can mark somebody permanently without explanation will eventually do it wrongly,
publicly, to someone who did nothing.

## 4. Issuance in which the issuer is paid last

Assets issued through Maschina are constructed so that the ordinary exit does not exist.

| The usual method | Why it fails here |
| --- | --- |
| Create more of the asset | Issued without that authority, permanently |
| Freeze holders or seize balances | Those authorities are never granted |
| Withdraw the liquidity | Liquidity is held by the program, not the issuer |
| Sell the issuer's holding into the market | Governed by the rules below |

The fourth is the real one, and it is answered with information the system already has. Every purchase
passed through the curve, so the program knows exactly what the issuer paid.

The issuer's holding is custodied by the program rather than delivered to their wallet, so it cannot be
moved off market or sold privately. It unlocks against time and milestones: days elapsed, holders,
depth of liquidity. An early exit returns the issuer's cost basis and nothing more. The confiscated
remainder is added to the reserve, which raises the floor beneath everyone still holding.

![Figure 1. The share of an issuer's gain returned to the reserve, by days since issuance (an illustrative schedule). The issuer is not prevented from earning; the issuer is paid last.](figures/fig-07-issuance.png)

The remainder goes to the reserve rather than to holders individually for a specific reason. A
distribution across a list of addresses is captured by whoever created the most addresses. An addition
to the reserve cannot be gamed and benefits every holder immediately, in one instruction, with no list
to iterate and no dust accounts to pay.

**Two honest limits.** An issuer can distribute holdings across addresses before issuance and sell from
those. Addresses funded by the issuer at or before issuance inherit the same rules, and sudden
concentration is detectable and expensive to standing, but no design closes this completely and anyone
claiming otherwise is selling something. And an issuer who can never realise a gain will simply issue
somewhere else, which is why the confiscation decays over time rather than standing as a
permanent wall.

## 5. Bounties

Coverage is the hard part of any detection system, so coverage is purchased.

Reporting an asset the checks missed, once confirmed, pays from a pool and raises standing. False
reports cost a small stake, so the pool is not farmed. Every confirmed report becomes a rule the system
applies from then on, which means participants extend the detector rather than complain about it.

The same structure applies to Maschina itself. Finding a defect pays, publicly, with standing attached,
and a sandboxed environment is part of the design for the hunting. The people most capable of taking money from this
system are offered a legitimate reason to point at the hole instead, which is cheaper than discovering
it the other way.

## 6. How the three compose

The checks decide whether an asset is safe to touch. The issuance rules decide whether an asset can be
emptied at all. Standing remembers who tried.

They share one foundation: the record supplies evidence, identity carries it between contexts, and
custody means nothing can be taken outright. An asset from an issuer with high standing and a posted
bond requires less scrutiny. An issuer whose standing has collapsed cannot issue at all.

That is one integrity system rather than three features, and it is the reason to bring an asset here
rather than to a venue that will let anybody do anything to anyone.

## References

[1] Chainalysis. *The 2026 Crypto Crime Report.* Over 62% of meme coins launched in 2025 flagged as
potential rug pulls within 30 days; approximately $17 billion lost to scams and fraud in 2025; average
rug pull of roughly $510,000.

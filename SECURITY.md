# Security

Maschina controls wallets and moves money, so security reports are taken seriously and answered
quickly.

**Maschina has not had an independent security audit.** It is early software holding real funds, and
anything found here is worth reporting.

## Reporting a vulnerability

Either is fine:

- [GitHub's private vulnerability reporting](https://github.com/maschina-labs/maschina/security/advisories/new)
- security@maschina.dev

Please do not open a public issue.

Include what you found, how to reproduce it, and what somebody could do with it.

## What to expect

| | |
| --- | --- |
| First reply | within 3 days |
| An assessment, with whether it is accepted and how severe | within 7 days |
| A fix for anything that can move or lose funds | as fast as it can be done safely, and you are told the plan |
| Credit | by name, or anonymously, however you prefer |
| Public write-up | after the fix ships, never before |

There is no bug bounty. This is a self-funded single-founder project with no revenue, so there is no
money to offer yet. That is stated plainly rather than left for you to find out.

## Safe harbour

Report in good faith under this policy and Maschina will not pursue or support legal action against
you, and will say so to anybody who asks.

Good faith means: you only touch accounts, machines and funds that are yours; you do not access,
change or keep anybody else's data; you do not degrade the service for other people; you do not run
denial of service, spam or social engineering against Maschina or its providers; you give a
reasonable chance to fix the issue before telling anyone else.

Third parties are not Maschina's to authorise. Turnkey, Cloudflare, Helius, Solana and the rest have
their own policies, and this safe harbour cannot cover testing against them.

## Scope

Everything in this repository, and the services at `maschina.dev`, `app.maschina.dev` and
`api.maschina.dev`. Of particular interest:

- Any way for a machine to move funds anywhere its owner's rules do not allow
- Any way to exceed a machine's budget or limits
- Any way to act as another owner or another machine
- Any way to read or alter the permanent record
- Any secret or key that could leave the service that holds it
- Any way a node could make the signer authorise something other than what it signed

## Out of scope

Reports from automated scanners with no demonstrated impact; missing headers or best practices with
no exploit behind them; anything needing physical access to a device or a compromised user machine;
and the known gaps already written down here and in the changelog.

## Supported versions

Only the latest release.

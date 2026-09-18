# @maschina/solana

Everything that knows about Solana lives here, and nothing outside this package imports a Solana
library. `pnpm check:boundaries` enforces it.

Today: clusters and RPC endpoints, address validation, SOL amounts, reading a token's mint from the
chain, and the list of tokens a machine is allowed to trade.

Decimals always come from the chain, never from the list. `checkMintMatches` holds the two together, so
a wrong entry stops a machine instead of trading a thousand times too much.

Balances are read the same way: whole numbers of the smallest unit, never the decimal an RPC offers
alongside them, which is floating point. Frozen token accounts are not counted as balance, and the
rent-exempt minimum is kept back, so what a budget sees is what a machine can actually spend.

Swap routers answer through one interface, so Jupiter, Orca on devnet and whatever comes next are
interchangeable. The number a rule reads from a quote is `minimumOutputAmount`, the least the trade may
produce, never the expectation.

Coming in A0 to A2: reading balances, Jupiter quotes and swaps, prices, token safety checks, building
and sending transactions, and confirming them. The rest of Maschina reaches all of it through a
small, plain interface, so a second chain would be a second implementation of that interface, not a
rewrite.

**Owns:** the chain.

**Never:** holds a key or signs. Signing is the signer's job, through the wallet provider.

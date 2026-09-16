# @maschina/solana

Everything that knows about Solana lives here, and nothing outside this package imports a Solana
library. `pnpm check:boundaries` enforces it.

Today: clusters and RPC endpoints, address validation, and SOL amounts.

Coming in A0 to A2: reading balances, Jupiter quotes and swaps, prices, token safety checks, building
and sending transactions, and confirming them. The rest of Maschina reaches all of it through a
small, plain interface, so a second chain would be a second implementation of that interface, not a
rewrite.

**Owns:** the chain.

**Never:** holds a key or signs. Signing is the signer's job, through the wallet provider.

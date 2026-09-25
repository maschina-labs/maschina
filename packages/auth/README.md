# @maschina/auth

Proving who is asking. A wallet signs a sentence naming this site, a nonce and a window, and this
package decides whether that signature means anything.

**Owns:**

- the exact sentence a wallet is asked to sign, rebuilt byte for byte when it comes back
- the four checks on it: this domain, this nonce, inside its window, really that account's signature
- base58 decoding, because a Solana address is a public key written in base58

**Does not own:**

- remembering nonces or sessions, which needs a database and belongs to whoever hands them out
- anything chain related. Verifying is ordinary ed25519, so nothing here imports a chain library and
  nothing here can reach a chain

**Depends on:** `@maschina/core`.

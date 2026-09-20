# @maschina/wallet

A machine's wallet and the policy that holds it, behind one interface.

The provider is the backstop, not the fence: it knows nothing about Maschina's budgets or schedules, and
it refuses anything its policy does not allow, whatever the rest of the system believes. Two services
use this package, for two different reasons and with two different keys:

- **services/signer** signs, with a key that may do nothing else.
- **services/provisioner** creates wallets and writes policies, with the admin key.

Nothing else may import a wallet provider's SDK, which the architecture check enforces.

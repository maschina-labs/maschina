# provisioner

Creates a machine: its wallet, its policy, and its place in the record.

Creating a wallet is an administrative act, so this is the only service that holds the wallet provider's
admin key. It never signs anything: signing is the signer's job, with a key that can do nothing else, and
the provider keeps the two apart.

The order is the point. The wallet is made, its policy is read back and checked against what was asked
for, and only then is the machine written. If either step fails there is no machine, because a machine
in the record with nothing holding its money is the one failure this system exists to prevent.

Nothing here is public. Only the gateway may ask, with a service token.

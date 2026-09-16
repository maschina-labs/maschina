# @maschina/rules

The limits every machine lives inside. Pure functions, no I/O.

- **Budgets** are three numbers: granted, reserved and settled. An action reserves the most it could
  cost before it starts, settles at what it actually cost, and releases the reservation if it never
  happened. A budget can never go negative, and an action can never cost more than it reserved.

Coming in A1 and A2: per-action and per-day caps, approved tokens and recipients, schedules, and the
plain-language "can / can never" summary shown before a machine starts.

**Owns:** deciding whether something is allowed.

**Never:** performs anything, reads the database or the network, or holds a key. The signer calls
these rules; the wallet provider's policy is the second, independent check.

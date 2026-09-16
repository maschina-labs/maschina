# @maschina/sdk

For developers building their own kinds of machine.

A machine kind is data: the settings it accepts, and a `decide` function that looks at the current
state and proposes an action or a skip, with a reason. Maschina runs it under the same budget, limits,
wallet policy and permanent record as every built-in machine.

```ts
import { defineMachineKind } from "@maschina/sdk";
```

**Owns:** the public interface for building machines.

**Never:** signs, writes to the record, or changes a machine's own limits. A machine built with the
SDK can only propose; Maschina decides whether it is allowed.

The public surface grows with the product. It is not published yet.

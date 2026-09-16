# @maschina/contracts

Zod schemas for everything that crosses the network between the gateway, the web app, the bots and
the SDK.

**Owns:** request and response shapes. The gateway builds its OpenAPI document from these.

**Never:** logic, database access, or anything that only one side needs.

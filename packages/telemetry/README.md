# @maschina/telemetry

Logging, error reporting and graceful shutdown, the same way in every service.

- `createLogger({ service })` writes structured JSON and removes secrets (keys, tokens, passwords,
  seed phrases, cookies) at any depth before anything is written.
- `initErrorReporting({ dsn })` reports to Sentry when a DSN is set, and is a no-op otherwise. The SDK
  is only loaded when it's used.
- `onShutdown(steps, { logger })` stops a service cleanly on SIGTERM or SIGINT, with a timeout.

**Owns:** how services observe themselves.

**Never:** writes a secret, sends personal data to an error tracker, or lets a hung shutdown block
forever.

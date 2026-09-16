# @maschina/service

The HTTP foundation every service is built on, so they all behave the same way.

- `createServiceApp()` adds request ids, request logging, security headers, a body size limit, a
  timeout, and structured errors. Unexpected errors are logged and reported in full, and the caller
  only ever sees "something went wrong".
- `registerHealth()` adds `/health` (the process is up) and `/ready` (its dependencies are, with a
  timeout on each check).
- `requireServiceToken()` protects internal routes with a shared secret, compared in constant time.
- `rateLimit()` is a per-client token bucket.
- `startServer()` listens and shuts down cleanly.

**Owns:** how services speak HTTP.

**Never:** business logic, or anything specific to one service.

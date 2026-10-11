# @maschina/accounts

People signing in: an email and a password, Google, GitHub, and a company's single sign-on (SAML and OIDC).
Better Auth keeps who a person is and proves how they came in; this package is the settings around it and the
one question the rest of Maschina asks: who is this request?

**Owns:**

- Better Auth's configuration: addresses are confirmed by a link before they are trusted, passwords are at
  least ten characters and kept only as a hash, the session is an HttpOnly cookie every `.maschina.dev` address
  shares
- the two emails (confirm an address, choose a new password) and the Resend mailer that sends them
- turning a request's session into an owner, made on first use, with no wallet until the person links one

**Does not own:**

- wallet sign in, which is `@maschina/auth` and the gateway's wallet routes, and stays as it is
- whether an owner may move money. That is checked where the money moves, and needs a wallet
- the sign in screens, which are `apps/auth`

**Depends on:** `@maschina/core`, `@maschina/db`, `better-auth` and its SSO plugin.

Better Auth's routes live under `/v1/auth/people`, apart from the wallet routes at `/v1/auth`. Its tables are
`auth_*` in `@maschina/db`, named apart from the wallet `sessions` table.

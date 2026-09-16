# @maschina/web

The web app. The first place owners create, fund, talk to and stop their machines.

- Vite, React, TanStack Router (file-based routes in `src/routes`) and TanStack Query.
- Styling and components come from `@maschina/ui`.
- Talks to the gateway through a client typed from the gateway's own routes.
- Wallet connection arrives with the first real screens.

```bash
pnpm web      # http://localhost:3000
```

Deploys to Vercel as a static site.

**Owns:** what owners see and do in a browser.

**Never:** holds a secret, reaches the database, or talks to any service but the gateway. Only
`VITE_` variables reach the browser.

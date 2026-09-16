# infra

Production deployment for the long-running services: the orchestrator, signer, daemon and bots.

Empty until the private beta. The web app and the gateway deploy to Vercel and need nothing here.

What will live here:

- A production compose file for the rented servers
- Reverse proxy and TLS configuration
- Backup jobs for the database
- Notes on how each environment is set up

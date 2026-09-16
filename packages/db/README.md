# @maschina/db

The database: connection, schema and migrations.

```bash
pnpm db:generate   # create a migration from schema changes
pnpm db:migrate    # apply pending migrations, as the owner role
pnpm db:studio     # browse the local database
```

- Two roles. `maschina_owner` runs migrations. `maschina_app` reads and writes rows and can never
  change the schema. Services connect as the app role.
- Remote databases are always reached over TLS.
- The permanent record arrives in A1: an append-only table the database itself refuses to update or
  delete, with everything else derived from it and rebuildable.

**Owns:** everything stored.

**Never:** imported by the daemon, the runtime, the bots or the web app. `pnpm check:boundaries`
enforces it.

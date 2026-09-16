import { env, loadEnv } from "@maschina/env";
import { runMigrations } from "./migrator.ts";

const config = loadEnv({ DATABASE_MIGRATION_URL: env.postgresUrl() });

await runMigrations(config.DATABASE_MIGRATION_URL);
process.stdout.write("Migrations applied.\n");

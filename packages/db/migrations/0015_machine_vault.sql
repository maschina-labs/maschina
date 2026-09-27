-- The vault beside a machine's wallet, where its profit is swept. Null for machines made before
-- vaults existed. Never shared, and never the trading wallet itself.
ALTER TABLE "machines" ADD COLUMN "vault_address" text;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_vault_address_unique" UNIQUE("vault_address");--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_vault_address_shape" CHECK ("vault_address" is null or "vault_address" ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$');--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_vault_is_separate" CHECK ("vault_address" is null or "vault_address" <> "wallet_address");
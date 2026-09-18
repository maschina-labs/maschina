CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "owners_wallet_address_shape" CHECK ("wallet_address" ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);

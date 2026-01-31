ALTER TABLE "trading_pairs" ADD COLUMN "volume_24h" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trading_pairs" ADD COLUMN "quote_volume_24h" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trading_pairs" ADD COLUMN "volume_rank" integer;--> statement-breakpoint
ALTER TABLE "trading_pairs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
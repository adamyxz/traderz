CREATE TABLE "trader_readers" (
	"trader_id" integer NOT NULL,
	"reader_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trader_readers" ADD CONSTRAINT "trader_readers_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_readers" ADD CONSTRAINT "trader_readers_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trader_readers_reader_idx" ON "trader_readers" ("reader_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trader_readers_trader_idx" ON "trader_readers" ("trader_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trader_readers" ADD CONSTRAINT "trader_readers_trader_id_reader_id_pk" PRIMARY KEY ("trader_id", "reader_id");
EXCEPTION
 WHEN duplicate_table THEN NULL;
END $$;

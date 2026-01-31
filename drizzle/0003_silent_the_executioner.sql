CREATE TABLE "trader_kline_intervals" (
	"trader_id" integer NOT NULL,
	"kline_interval_id" integer NOT NULL,
	CONSTRAINT "trader_kline_intervals_trader_id_kline_interval_id_pk" PRIMARY KEY("trader_id","kline_interval_id")
);
--> statement-breakpoint
ALTER TABLE "traders" ADD COLUMN "preferred_trading_pair_id" integer;--> statement-breakpoint
ALTER TABLE "trader_kline_intervals" ADD CONSTRAINT "trader_kline_intervals_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_kline_intervals" ADD CONSTRAINT "trader_kline_intervals_kline_interval_id_kline_intervals_id_fk" FOREIGN KEY ("kline_interval_id") REFERENCES "public"."kline_intervals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trader_kline_intervals_trader_idx" ON "trader_kline_intervals" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "trader_kline_intervals_interval_idx" ON "trader_kline_intervals" USING btree ("kline_interval_id");--> statement-breakpoint
ALTER TABLE "traders" ADD CONSTRAINT "traders_preferred_trading_pair_id_trading_pairs_id_fk" FOREIGN KEY ("preferred_trading_pair_id") REFERENCES "public"."trading_pairs"("id") ON DELETE no action ON UPDATE no action;
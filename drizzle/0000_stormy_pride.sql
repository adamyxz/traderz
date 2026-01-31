CREATE TYPE "public"."heartbeat_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'skipped_outside_hours', 'skipped_no_intervals', 'skipped_no_readers');--> statement-breakpoint
CREATE TYPE "public"."history_action" AS ENUM('open', 'close', 'liquidate', 'price_update', 'stop_loss_triggered', 'take_profit_triggered', 'margin_added', 'margin_removed', 'modify_sl_tp');--> statement-breakpoint
CREATE TYPE "public"."holding_period" AS ENUM('intraday', 'short_term', 'medium_term', 'long_term');--> statement-breakpoint
CREATE TYPE "public"."optimization_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."position_side" AS ENUM('long', 'short');--> statement-breakpoint
CREATE TYPE "public"."position_status" AS ENUM('open', 'closed', 'liquidated');--> statement-breakpoint
CREATE TYPE "public"."position_strategy" AS ENUM('martingale', 'pyramid', 'none');--> statement-breakpoint
CREATE TYPE "public"."reader_param_type" AS ENUM('string', 'number', 'boolean', 'object', 'array', 'enum');--> statement-breakpoint
CREATE TYPE "public"."trader_status" AS ENUM('enabled', 'disabled', 'paused');--> statement-breakpoint
CREATE TYPE "public"."trading_strategy" AS ENUM('trend', 'oscillation', 'arbitrage', 'market_making', 'scalping', 'swing');--> statement-breakpoint
CREATE TABLE "heartbeat_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"trader_id" integer NOT NULL,
	"status" "heartbeat_status" NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration" integer,
	"was_within_active_hours" boolean DEFAULT true NOT NULL,
	"micro_decisions" text,
	"final_decision" text,
	"execution_action" text,
	"execution_result" text,
	"readers_executed" text,
	"error_message" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "kline_intervals" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"seconds" integer NOT NULL,
	"display_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kline_intervals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "position_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"position_id" integer NOT NULL,
	"action" "history_action" NOT NULL,
	"price" numeric(20, 8),
	"quantity" numeric(20, 8),
	"pnl" numeric(20, 8),
	"fee" numeric(20, 8),
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"trader_id" integer NOT NULL,
	"trading_pair_id" integer NOT NULL,
	"side" "position_side" NOT NULL,
	"status" "position_status" DEFAULT 'open' NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"current_price" numeric(20, 8) NOT NULL,
	"leverage" numeric(5, 2) NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"position_size" numeric(20, 8) NOT NULL,
	"margin" numeric(20, 8) NOT NULL,
	"open_fee" numeric(20, 8) DEFAULT '0' NOT NULL,
	"close_fee" numeric(20, 8) DEFAULT '0' NOT NULL,
	"unrealized_pnl" numeric(20, 8) DEFAULT '0' NOT NULL,
	"realized_pnl" numeric(20, 8) DEFAULT '0' NOT NULL,
	"stop_loss_price" numeric(20, 8),
	"take_profit_price" numeric(20, 8),
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"trading_pair_id" integer NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"price_change_24h" numeric(20, 8),
	"price_change_percent_24h" numeric(10, 4),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "price_cache_trading_pair_id_unique" UNIQUE("trading_pair_id")
);
--> statement-breakpoint
CREATE TABLE "reader_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"param_name" text NOT NULL,
	"param_type" "reader_param_type" NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"validation_rules" text,
	"enum_values" text
);
--> statement-breakpoint
CREATE TABLE "readers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"script_path" text NOT NULL,
	"script_hash" text,
	"timeout" integer DEFAULT 30000,
	"mandatory" boolean DEFAULT false NOT NULL,
	CONSTRAINT "readers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "system_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_configurations_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "trader_kline_intervals" (
	"trader_id" integer NOT NULL,
	"kline_interval_id" integer NOT NULL,
	CONSTRAINT "trader_kline_intervals_trader_id_kline_interval_id_pk" PRIMARY KEY("trader_id","kline_interval_id")
);
--> statement-breakpoint
CREATE TABLE "trader_optimizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"trader_id" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration" integer,
	"position_count" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"llm_request" text NOT NULL,
	"llm_response" text NOT NULL,
	"llm_reasoning" text,
	"previous_config" text NOT NULL,
	"suggested_config" text NOT NULL,
	"applied_changes" text NOT NULL,
	"status" "optimization_status" NOT NULL,
	"error_message" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trader_readers" (
	"trader_id" integer NOT NULL,
	"reader_id" integer NOT NULL,
	CONSTRAINT "trader_readers_trader_id_reader_id_pk" PRIMARY KEY("trader_id","reader_id")
);
--> statement-breakpoint
CREATE TABLE "traders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "trader_status" DEFAULT 'enabled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"aggressiveness_level" integer NOT NULL,
	"max_leverage" numeric(5, 2) NOT NULL,
	"min_leverage" numeric(5, 2) NOT NULL,
	"max_positions" integer NOT NULL,
	"max_position_size" numeric(10, 2) NOT NULL,
	"min_trade_amount" numeric(10, 2) NOT NULL,
	"position_strategy" "position_strategy" DEFAULT 'none' NOT NULL,
	"allow_short" boolean DEFAULT false NOT NULL,
	"max_drawdown" numeric(5, 2) NOT NULL,
	"stop_loss_threshold" numeric(5, 2) NOT NULL,
	"position_stop_loss" numeric(5, 2) NOT NULL,
	"position_take_profit" numeric(5, 2) NOT NULL,
	"max_consecutive_losses" integer NOT NULL,
	"daily_max_loss" numeric(10, 2) NOT NULL,
	"risk_preference_score" integer NOT NULL,
	"heartbeat_interval" integer NOT NULL,
	"active_time_start" text NOT NULL,
	"active_time_end" text NOT NULL,
	"trading_strategy" "trading_strategy" NOT NULL,
	"holding_period" "holding_period" NOT NULL,
	"preferred_trading_pair_id" integer,
	"last_optimized_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "trading_pairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"base_asset" text NOT NULL,
	"quote_asset" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"contract_type" text DEFAULT 'perpetual' NOT NULL,
	"volume_24h" numeric(20, 8),
	"quote_volume_24h" numeric(20, 8),
	"volume_rank" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trading_pairs_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
ALTER TABLE "heartbeat_history" ADD CONSTRAINT "heartbeat_history_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_history" ADD CONSTRAINT "position_history_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_trading_pair_id_trading_pairs_id_fk" FOREIGN KEY ("trading_pair_id") REFERENCES "public"."trading_pairs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_cache" ADD CONSTRAINT "price_cache_trading_pair_id_trading_pairs_id_fk" FOREIGN KEY ("trading_pair_id") REFERENCES "public"."trading_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_parameters" ADD CONSTRAINT "reader_parameters_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_kline_intervals" ADD CONSTRAINT "trader_kline_intervals_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_kline_intervals" ADD CONSTRAINT "trader_kline_intervals_kline_interval_id_kline_intervals_id_fk" FOREIGN KEY ("kline_interval_id") REFERENCES "public"."kline_intervals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_optimizations" ADD CONSTRAINT "trader_optimizations_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_readers" ADD CONSTRAINT "trader_readers_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_readers" ADD CONSTRAINT "trader_readers_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traders" ADD CONSTRAINT "traders_preferred_trading_pair_id_trading_pairs_id_fk" FOREIGN KEY ("preferred_trading_pair_id") REFERENCES "public"."trading_pairs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "heartbeat_history_trader_idx" ON "heartbeat_history" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "heartbeat_history_status_idx" ON "heartbeat_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "heartbeat_history_triggered_at_idx" ON "heartbeat_history" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "position_history_position_idx" ON "position_history" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "position_history_action_idx" ON "position_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "position_history_created_at_idx" ON "position_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "position_history_position_created_idx" ON "position_history" USING btree ("position_id","created_at");--> statement-breakpoint
CREATE INDEX "positions_trader_idx" ON "positions" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "positions_trading_pair_idx" ON "positions" USING btree ("trading_pair_id");--> statement-breakpoint
CREATE INDEX "positions_status_idx" ON "positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "positions_opened_at_idx" ON "positions" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "positions_trader_status_idx" ON "positions" USING btree ("trader_id","status");--> statement-breakpoint
CREATE INDEX "price_cache_updated_at_idx" ON "price_cache" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "trader_kline_intervals_trader_idx" ON "trader_kline_intervals" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "trader_kline_intervals_interval_idx" ON "trader_kline_intervals" USING btree ("kline_interval_id");--> statement-breakpoint
CREATE INDEX "trader_optimizations_trader_idx" ON "trader_optimizations" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "trader_optimizations_status_idx" ON "trader_optimizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trader_optimizations_started_at_idx" ON "trader_optimizations" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "trader_readers_trader_idx" ON "trader_readers" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "trader_readers_reader_idx" ON "trader_readers" USING btree ("reader_id");
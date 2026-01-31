-- 创建仓位方向枚举
CREATE TYPE "position_side" AS ENUM ('long', 'short');
--> statement-breakpoint

-- 创建仓位状态枚举
CREATE TYPE "position_status" AS ENUM ('open', 'closed', 'liquidated');
--> statement-breakpoint

-- 创建历史记录操作类型枚举
CREATE TYPE "history_action" AS ENUM ('open', 'close', 'liquidate', 'price_update', 'stop_loss_triggered', 'take_profit_triggered', 'margin_added', 'margin_removed');
--> statement-breakpoint

-- 创建仓位表
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY,
	"trader_id" integer NOT NULL,
	"trading_pair_id" integer NOT NULL,
	"side" "position_side" NOT NULL,
	"status" "position_status" DEFAULT 'open' NOT NULL,
	"entry_price" numeric(20,8) NOT NULL,
	"current_price" numeric(20,8) NOT NULL,
	"leverage" numeric(5,2) NOT NULL,
	"quantity" numeric(20,8) NOT NULL,
	"position_size" numeric(20,8) NOT NULL,
	"margin" numeric(20,8) NOT NULL,
	"open_fee" numeric(20,8) DEFAULT '0' NOT NULL,
	"close_fee" numeric(20,8) DEFAULT '0' NOT NULL,
	"unrealized_pnl" numeric(20,8) DEFAULT '0' NOT NULL,
	"realized_pnl" numeric(20,8) DEFAULT '0' NOT NULL,
	"stop_loss_price" numeric(20,8),
	"take_profit_price" numeric(20,8),
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 创建外键约束
ALTER TABLE "positions" ADD CONSTRAINT "positions_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_trading_pair_id_trading_pairs_id_fk" FOREIGN KEY ("trading_pair_id") REFERENCES "public"."trading_pairs"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

-- 创建索引
CREATE INDEX IF NOT EXISTS "positions_opened_at_idx" ON "positions" ("opened_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "positions_status_idx" ON "positions" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "positions_trader_idx" ON "positions" ("trader_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "positions_trader_status_idx" ON "positions" ("trader_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "positions_trading_pair_idx" ON "positions" ("trading_pair_id");
--> statement-breakpoint

-- 创建仓位历史记录表
CREATE TABLE "position_history" (
	"id" serial PRIMARY KEY,
	"position_id" integer NOT NULL,
	"action" "history_action" NOT NULL,
	"price" numeric(20,8),
	"quantity" numeric(20,8),
	"pnl" numeric(20,8),
	"fee" numeric(20,8),
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 创建外键约束
ALTER TABLE "position_history" ADD CONSTRAINT "position_history_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- 创建索引
CREATE INDEX IF NOT EXISTS "position_history_action_idx" ON "position_history" ("action");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "position_history_created_at_idx" ON "position_history" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "position_history_position_created_idx" ON "position_history" ("position_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "position_history_position_idx" ON "position_history" ("position_id");
--> statement-breakpoint

-- 创建价格缓存表
CREATE TABLE "price_cache" (
	"id" serial PRIMARY KEY,
	"trading_pair_id" integer NOT NULL UNIQUE,
	"price" numeric(20,8) NOT NULL,
	"price_change_24h" numeric(20,8),
	"price_change_percent_24h" numeric(10,4),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 创建外键约束
ALTER TABLE "price_cache" ADD CONSTRAINT "price_cache_trading_pair_id_trading_pairs_id_fk" FOREIGN KEY ("trading_pair_id") REFERENCES "public"."trading_pairs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- 创建索引
CREATE INDEX IF NOT EXISTS "price_cache_updated_at_idx" ON "price_cache" ("updated_at");

-- Add last_optimized_at to traders table
ALTER TABLE "traders" ADD COLUMN "last_optimized_at" timestamp;

-- Create optimization_status enum
CREATE TYPE "optimization_status" AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- Create trader_optimizations table
CREATE TABLE "trader_optimizations" (
  "id" serial PRIMARY KEY,
  "trader_id" integer NOT NULL REFERENCES "traders"(id) ON DELETE CASCADE,
  "started_at" timestamp NOT NULL DEFAULT NOW(),
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
  "status" optimization_status NOT NULL,
  "error_message" text,
  "metadata" text,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);

-- Create indexes for trader_optimizations
CREATE INDEX "trader_optimizations_trader_idx" ON "trader_optimizations"("trader_id");
CREATE INDEX "trader_optimizations_status_idx" ON "trader_optimizations"("status");
CREATE INDEX "trader_optimizations_started_at_idx" ON "trader_optimizations"("started_at");

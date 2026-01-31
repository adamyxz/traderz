CREATE TYPE "public"."reader_execution_status" AS ENUM('pending', 'running', 'success', 'error', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."reader_param_type" AS ENUM('string', 'number', 'boolean', 'object', 'array', 'enum');--> statement-breakpoint
CREATE TYPE "public"."reader_status" AS ENUM('active', 'inactive', 'deprecated', 'testing');--> statement-breakpoint
CREATE TABLE "reader_execution_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" text NOT NULL,
	"reader_id" integer NOT NULL,
	"triggered_by" text NOT NULL,
	"input_params" text NOT NULL,
	"status" "reader_execution_status" NOT NULL,
	"output_data" text,
	"error_message" text,
	"execution_time" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reader_execution_history_execution_id_unique" UNIQUE("execution_id")
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
	"display_name" text NOT NULL,
	"description" text,
	"status" "reader_status" DEFAULT 'testing' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"script_path" text NOT NULL,
	"script_hash" text,
	"timeout" integer DEFAULT 30000,
	"cache_enabled" boolean DEFAULT true,
	"total_executions" integer DEFAULT 0,
	"successful_executions" integer DEFAULT 0,
	"last_executed_at" timestamp,
	"category" text,
	"tags" text,
	CONSTRAINT "readers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "reader_execution_history" ADD CONSTRAINT "reader_execution_history_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_parameters" ADD CONSTRAINT "reader_parameters_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;
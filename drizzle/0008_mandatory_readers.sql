-- Add mandatory field to readers table
ALTER TABLE "readers" ADD COLUMN "mandatory" boolean DEFAULT false NOT NULL;

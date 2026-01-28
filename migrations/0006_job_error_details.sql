-- Add error_details JSONB column to enrichment_jobs table
-- Purpose: Store structured error information when jobs are auto-paused due to critical LLM errors
-- Notes:
-- - Nullable column for backward compatibility (existing jobs have NULL)
-- - JSONB allows efficient querying and indexing if needed
-- - Idempotent: safe to run multiple times

ALTER TABLE public.enrichment_jobs 
ADD COLUMN IF NOT EXISTS error_details JSONB;

-- Optional: Add comment for documentation
COMMENT ON COLUMN public.enrichment_jobs.error_details IS 'Structured error details when job is auto-paused due to critical LLM errors. Contains category, user message, technical details, row/prompt context, and metadata.';


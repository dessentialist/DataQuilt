-- Add thinking_mode and thinking_effort columns to prompt_templates
-- Purpose: Let users persist a per-template preference for extended thinking / reasoning effort.
-- Per-job prompt configs (enrichment_jobs.prompts_config JSONB) carry the same fields inside each
-- prompt object, so no DDL is required on enrichment_jobs.
--
-- Values:
--   thinking_mode:   'auto' (default — let the provider decide / use its default), 'on', 'off'
--   thinking_effort: 'low' | 'medium' | 'high' (optional; only meaningful when thinking_mode != 'off')
--
-- Notes:
--   - Nullable for backward compatibility; 'auto' default keeps existing templates behaving identically.
--   - Idempotent: safe to run multiple times.
--   - No CHECK constraints — app-level Zod validation handles enum enforcement, mirroring the
--     pattern used for other text-enum columns in this schema.

ALTER TABLE public.prompt_templates
  ADD COLUMN IF NOT EXISTS thinking_mode TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE public.prompt_templates
  ADD COLUMN IF NOT EXISTS thinking_effort TEXT;

COMMENT ON COLUMN public.prompt_templates.thinking_mode IS 'Extended thinking / reasoning toggle: auto | on | off. Default auto lets the provider decide.';
COMMENT ON COLUMN public.prompt_templates.thinking_effort IS 'Optional reasoning-effort hint when thinking_mode is on: low | medium | high.';

-- migrations/0005_system_templates_rls.sql
-- Purpose: Enable RLS and add per-user policies for public.system_templates
-- Notes:
-- - Idempotent: safe to run multiple times
-- - Scopes access to authenticated users where user_id = auth.uid()
-- - Server/worker using service_role bypasses RLS (expected)

-- Enable RLS
ALTER TABLE public.system_templates ENABLE ROW LEVEL SECURITY;
-- Optional hardening:
-- ALTER TABLE public.system_templates FORCE ROW LEVEL SECURITY;

-- Ensure privileges are correct for Supabase roles
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_templates TO authenticated;
REVOKE ALL ON TABLE public.system_templates FROM anon;

-- SELECT: users can read only their rows
DO $$
BEGIN
  CREATE POLICY system_templates_select_own
    ON public.system_templates
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

-- INSERT: users can insert rows only for themselves
DO $$
BEGIN
  CREATE POLICY system_templates_insert_own
    ON public.system_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

-- UPDATE: users can update only their rows (ownership preserved)
DO $$
BEGIN
  CREATE POLICY system_templates_update_own
    ON public.system_templates
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

-- DELETE: users can delete only their rows
DO $$
BEGIN
  CREATE POLICY system_templates_delete_own
    ON public.system_templates
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;
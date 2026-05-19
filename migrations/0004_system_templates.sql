-- Create system_templates table
CREATE TABLE IF NOT EXISTS system_templates (
  system_template_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  name TEXT NOT NULL,
  system_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_templates_user ON system_templates(user_id);



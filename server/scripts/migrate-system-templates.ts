import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is not set. Please export it and rerun.");
    process.exit(1);
  }

  console.log("[migrate-system-templates] Connecting to database...");
  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    console.log("[migrate-system-templates] Creating table system_templates if not exists...");
    await sql`
      CREATE TABLE IF NOT EXISTS system_templates (
        system_template_id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(user_id),
        name TEXT NOT NULL,
        system_text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_system_templates_user ON system_templates(user_id);
    `;
    console.log("✅ system_templates migration completed successfully.");
  } catch (err: any) {
    console.error("❌ Migration failed:", err?.message || String(err));
    process.exit(1);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main();



import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(url, { ssl: "require" as any, max: 1 });
  try {
    console.log("Connecting to database...");
    await sql`select 1`;

    console.log("Ensuring enum value 'deepseek' exists on type llm_provider...");
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'llm_provider' AND e.enumlabel = 'deepseek'
        ) THEN
          ALTER TYPE llm_provider ADD VALUE 'deepseek';
        END IF;
      END
      $$;
    `);

    console.log("Enum updated successfully.");
  } catch (err: any) {
    console.error("Migration failed:", err?.message || err);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main();



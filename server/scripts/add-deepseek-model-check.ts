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

    console.log("Locating existing CHECK constraints on prompt_templates...");
    const constraints = await sql<{
      conname: string;
      def: string;
    }[]>`
      SELECT c.conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE t.relname = 'prompt_templates' AND c.contype = 'c'
    `;

    const modelChecks = constraints.filter((c) => /model/i.test(c.def));
    await sql.begin(async (tx) => {
      for (const c of modelChecks) {
        console.log(`Dropping constraint ${c.conname}: ${c.def}`);
        await tx.unsafe(`ALTER TABLE prompt_templates DROP CONSTRAINT ${c.conname};`);
      }

      const newDef = "CHECK (model IN ('openai','gemini','perplexity','deepseek'))";
      console.log("Adding new constraint prompt_templates_model_check:", newDef);
      await tx.unsafe(
        `ALTER TABLE prompt_templates ADD CONSTRAINT prompt_templates_model_check ${newDef};`,
      );
    });

    console.log("Constraint updated successfully.");
  } catch (err: any) {
    console.error("Migration failed:", err?.message || err);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main();



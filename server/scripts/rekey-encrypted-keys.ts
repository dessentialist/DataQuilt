/**
 * One-time migration script to re-encrypt existing user API keys from the
 * legacy format to the new AES-256-GCM format provided by `shared/crypto`.
 *
 * Behavior:
 * - Reads all users with `llmApiKeys`
 * - Decrypts using `decryptApiKeys` (supports legacy and new formats)
 * - Re-encrypts with `encryptApiKeys` (new format)
 * - Writes back per user
 *
 * Usage:
 *   ENCRYPTION_KEY=... DATABASE_URL=... npm run migrate:rekey
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@shared/schema";
import { users } from "@shared/schema";
import { encryptApiKeys, decryptApiKeys } from "@shared/crypto";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });

  console.log("Starting rekey migration for user API keys...");
  const allUsers = await db.select().from(users);
  let updatedCount = 0;

  for (const u of allUsers) {
    if (!u.llmApiKeys) continue;
    try {
      const decrypted = decryptApiKeys(u.llmApiKeys as Record<string, string>);
      const reEncrypted = encryptApiKeys(decrypted);
      await db.update(users).set({ llmApiKeys: reEncrypted }).where(eq(users.userId, u.userId));
      updatedCount += 1;
      console.log(`Rekeyed user ${u.userId}`);
    } catch (e) {
      console.warn(
        `Skipping user ${u.userId} due to decryption error:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log(`Completed rekey. Users updated: ${updatedCount}`);
  await sql.end({ timeout: 1 });
}

main().catch((e) => {
  console.error("Fatal error in rekey script:", e);
  process.exit(1);
});

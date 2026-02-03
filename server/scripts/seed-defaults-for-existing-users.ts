import "dotenv/config";
import { db } from "../config/database";
import { users } from "@shared/schema";
import { DefaultsSeedingService } from "../services/defaults.seeding.service";
import { logInfo, logError } from "@shared/logger";

async function main() {
  const batchSize = parseInt(process.env.SEED_DEFAULTS_BATCH_SIZE || "50", 10);
  logInfo("seed_defaults_script:start", { batchSize });

  let offset = 0;
  let totalSeeded = 0;

  while (true) {
    const batch = await db.select().from(users).limit(batchSize).offset(offset);
    if (!batch.length) break;

    for (const u of batch) {
      try {
        const res = await DefaultsSeedingService.seedDefaultsForUser({ userId: u.userId });
        totalSeeded += (res.promptsInserted || 0) + (res.systemsInserted || 0);
      } catch (e) {
        logError("seed_defaults_script:user_failed", { userId: u.userId, error: String(e) });
      }
    }

    offset += batch.length;
    logInfo("seed_defaults_script:progress", { offset, totalSeeded });
  }

  logInfo("seed_defaults_script:done", { totalSeeded });
}

main().catch((err) => {
  logError("seed_defaults_script:fatal", { error: String(err) });
  process.exit(1);
});



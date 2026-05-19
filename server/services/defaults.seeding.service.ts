import { logError, logInfo } from "@shared/logger";
import { DEFAULT_PROMPT_TEMPLATES, DEFAULT_SYSTEM_TEMPLATES } from "@shared/defaultTemplates";
import { PromptTemplatesRepository } from "../repositories/templates.repository";
import { SystemTemplatesRepository } from "../repositories/system.templates.repository";

/**
 * DefaultsSeedingService
 * Inserts per-user default prompt and system templates on first login.
 * Idempotent by (userId, name) checks. Non-blocking: logs errors and continues.
 */
export const DefaultsSeedingService = {
  async seedDefaultsForUser(params: { userId: string; requestId?: string }) {
    const { userId, requestId } = params;
    logInfo("defaults_seed:start", { userId, requestId });

    let promptsInserted = 0;
    let systemsInserted = 0;

    // Seed prompt templates
    for (const tmpl of DEFAULT_PROMPT_TEMPLATES) {
      try {
        const exists = await PromptTemplatesRepository.findByNameForUser(userId, tmpl.name);
        if (!exists) {
          await PromptTemplatesRepository.create({ userId, ...tmpl });
          promptsInserted += 1;
          logInfo("defaults_seed:prompt_inserted", { userId, name: tmpl.name, requestId });
        }
      } catch (e) {
        logError("defaults_seed:prompt_error", { userId, name: tmpl.name, requestId, error: String(e) });
      }
    }

    // Seed system templates
    for (const sys of DEFAULT_SYSTEM_TEMPLATES) {
      try {
        const exists = await SystemTemplatesRepository.findByNameForUser(userId, sys.name);
        if (!exists) {
          await SystemTemplatesRepository.create({ userId, ...sys });
          systemsInserted += 1;
          logInfo("defaults_seed:system_inserted", { userId, name: sys.name, requestId });
        }
      } catch (e) {
        logError("defaults_seed:system_error", { userId, name: sys.name, requestId, error: String(e) });
      }
    }

    logInfo("defaults_seed:complete", { userId, requestId, promptsInserted, systemsInserted });
    return { promptsInserted, systemsInserted } as const;
  },
};



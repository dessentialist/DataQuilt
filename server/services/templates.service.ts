import { insertPromptTemplateSchema, InsertPromptTemplate } from "@shared/schema";
import { PromptTemplatesRepository } from "../repositories/templates.repository";
import { logInfo, logError } from "@shared/logger";

/**
 * TemplatesService
 * - Owns the use-case logic for template creation
 * - Validates input and coordinates repository writes
 */
export const TemplatesService = {
  /**
   * Create a template for a given user. Validates the payload and writes using the repository.
   */
  async createTemplate(params: { userId: string; input: Omit<InsertPromptTemplate, "userId">; requestId?: string }) {
    const { userId, input, requestId } = params;
    logInfo("TemplatesService.createTemplate:start", { userId, requestId });

    // Validate using existing schema; inject userId as the controller previously did
    const validated: InsertPromptTemplate = insertPromptTemplateSchema.parse({
      ...input,
      userId,
    });

    const created = await PromptTemplatesRepository.create(validated);
    logInfo("TemplatesService.createTemplate:success", { userId, promptId: created.promptId, requestId });
    return created;
  },

  async listTemplates(params: { userId: string; requestId?: string }) {
    const { userId, requestId } = params;
    logInfo("TemplatesService.listTemplates:start", { userId, requestId });
    const rows = await PromptTemplatesRepository.listByUser(userId);
    logInfo("TemplatesService.listTemplates:success", { userId, count: rows.length, requestId });
    return rows;
  },

  async updateTemplate(params: { userId: string; templateId: string; input: Partial<Omit<InsertPromptTemplate, "userId">>; requestId?: string }) {
    const { userId, templateId, input, requestId } = params;
    logInfo("TemplatesService.updateTemplate:start", { userId, templateId, requestId });

    // Validate only provided fields
    const partialSchema = insertPromptTemplateSchema.partial();
    const validated = partialSchema.parse({ ...input });

    const updated = await PromptTemplatesRepository.updateForUser(templateId, userId, validated);
    if (!updated) {
      const err: any = new Error("Template not found");
      err.code = "TEMPLATES_NOT_FOUND";
      throw err;
    }
    logInfo("TemplatesService.updateTemplate:success", { userId, templateId, requestId });
    return updated;
  },

  async deleteTemplate(params: { userId: string; templateId: string; requestId?: string }) {
    const { userId, templateId, requestId } = params;
    logInfo("TemplatesService.deleteTemplate:start", { userId, templateId, requestId });
    const deleted = await PromptTemplatesRepository.deleteForUser(templateId, userId);
    if (!deleted) {
      const err: any = new Error("Template not found");
      err.code = "TEMPLATES_NOT_FOUND";
      throw err;
    }
    logInfo("TemplatesService.deleteTemplate:success", { userId, templateId, requestId });
    return { success: true } as const;
  },
};



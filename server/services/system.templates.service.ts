import { insertSystemTemplateSchema, InsertSystemTemplate } from "@shared/schema";
import { SystemTemplatesRepository } from "../repositories/system.templates.repository";
import { logInfo } from "@shared/logger";

export const SystemTemplatesService = {
  async createSystemTemplate(params: { userId: string; input: Omit<InsertSystemTemplate, "userId">; requestId?: string }) {
    const { userId, input, requestId } = params;
    logInfo("SystemTemplatesService.create:start", { userId, requestId });
    const validated: InsertSystemTemplate = insertSystemTemplateSchema.parse({ ...input, userId });
    const created = await SystemTemplatesRepository.create(validated);
    logInfo("SystemTemplatesService.create:success", { userId, systemTemplateId: created.systemTemplateId, requestId });
    return created;
  },

  async listSystemTemplates(params: { userId: string; requestId?: string }) {
    const { userId, requestId } = params;
    logInfo("SystemTemplatesService.list:start", { userId, requestId });
    const rows = await SystemTemplatesRepository.listByUser(userId);
    logInfo("SystemTemplatesService.list:success", { userId, count: rows.length, requestId });
    return rows;
  },

  async updateSystemTemplate(params: { userId: string; systemTemplateId: string; input: Partial<Omit<InsertSystemTemplate, "userId">>; requestId?: string }) {
    const { userId, systemTemplateId, input, requestId } = params;
    logInfo("SystemTemplatesService.update:start", { userId, systemTemplateId, requestId });
    const partial = insertSystemTemplateSchema.partial().parse({ ...input });
    const updated = await SystemTemplatesRepository.updateForUser(systemTemplateId, userId, partial);
    if (!updated) {
      const err: any = new Error("System template not found");
      err.code = "TEMPLATES_NOT_FOUND"; // reuse for now to avoid catalog changes
      throw err;
    }
    logInfo("SystemTemplatesService.update:success", { userId, systemTemplateId, requestId });
    return updated;
  },

  async deleteSystemTemplate(params: { userId: string; systemTemplateId: string; requestId?: string }) {
    const { userId, systemTemplateId, requestId } = params;
    logInfo("SystemTemplatesService.delete:start", { userId, systemTemplateId, requestId });
    const deleted = await SystemTemplatesRepository.deleteForUser(systemTemplateId, userId);
    if (!deleted) {
      const err: any = new Error("System template not found");
      err.code = "TEMPLATES_NOT_FOUND"; // reuse for now to avoid catalog changes
      throw err;
    }
    logInfo("SystemTemplatesService.delete:success", { userId, systemTemplateId, requestId });
    return { success: true } as const;
  },
};



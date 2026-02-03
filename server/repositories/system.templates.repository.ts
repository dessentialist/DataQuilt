import { db } from "../config/database";
import { systemTemplates, InsertSystemTemplate } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * SystemTemplatesRepository
 * Encapsulates all Drizzle queries for the system_templates table.
 * No business logic; pure data access.
 */
export const SystemTemplatesRepository = {
  async create(data: InsertSystemTemplate) {
    const toInsert = {
      systemTemplateId: uuidv4(),
      ...data,
    } as any;
    const [row] = await db.insert(systemTemplates).values(toInsert).returning();
    return row;
  },

  async listByUser(userId: string) {
    const rows = await db.query.systemTemplates.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
    return rows;
  },

  async getByIdForUser(systemTemplateId: string, userId: string) {
    const rows = await db.query.systemTemplates.findMany({
      where: (t, { and, eq }) => and(eq(t.systemTemplateId, systemTemplateId), eq(t.userId, userId)),
      limit: 1,
    });
    return rows[0] ?? null;
  },

  async findByNameForUser(userId: string, name: string) {
    const rows = await db.query.systemTemplates.findMany({
      where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.name, name)),
      limit: 1,
    });
    return rows[0] ?? null;
  },

  async updateForUser(systemTemplateId: string, userId: string, data: Partial<InsertSystemTemplate>) {
    const [row] = await db
      .update(systemTemplates)
      .set(data)
      .where(and(eq(systemTemplates.systemTemplateId, systemTemplateId), eq(systemTemplates.userId, userId)))
      .returning();
    return row ?? null;
  },

  async deleteForUser(systemTemplateId: string, userId: string) {
    const [row] = await db
      .delete(systemTemplates)
      .where(and(eq(systemTemplates.systemTemplateId, systemTemplateId), eq(systemTemplates.userId, userId)))
      .returning();
    return row ?? null;
  },
};



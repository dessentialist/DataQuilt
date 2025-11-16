import { db } from "../config/database";
import { promptTemplates, InsertPromptTemplate } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * PromptTemplatesRepository
 * - Encapsulates all Drizzle queries for the prompt_templates table
 * - No business logic; pure data access
 */
export const PromptTemplatesRepository = {
  /**
   * Create a new prompt template row.
   * The repository generates the primary key to keep callers simple and deterministic.
   */
  async create(data: InsertPromptTemplate) {
    const toInsert = {
      promptId: uuidv4(),
      ...data,
    };

    const [row] = await db.insert(promptTemplates).values(toInsert).returning();
    return row;
  },
  async listByUser(userId: string) {
    const rows = await db.query.promptTemplates.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
    return rows;
  },
  async getByIdForUser(promptId: string, userId: string) {
    const rows = await db.query.promptTemplates.findMany({
      where: (t, { and, eq }) => and(eq(t.promptId, promptId), eq(t.userId, userId)),
      limit: 1,
    });
    return rows[0] ?? null;
  },
  async findByNameForUser(userId: string, name: string) {
    const rows = await db.query.promptTemplates.findMany({
      where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.name, name)),
      limit: 1,
    });
    return rows[0] ?? null;
  },
  async updateForUser(promptId: string, userId: string, data: Partial<InsertPromptTemplate>) {
    const [row] = await db
      .update(promptTemplates)
      .set(data)
      .where(and(eq(promptTemplates.promptId, promptId), eq(promptTemplates.userId, userId)))
      .returning();
    return row ?? null;
  },
  async deleteForUser(promptId: string, userId: string) {
    const [row] = await db
      .delete(promptTemplates)
      .where(and(eq(promptTemplates.promptId, promptId), eq(promptTemplates.userId, userId)))
      .returning();
    return row ?? null;
  },
};



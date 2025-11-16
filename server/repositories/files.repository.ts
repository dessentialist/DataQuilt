import { db } from "../config/database";
import { files } from "@shared/schema";
import { and, eq } from "drizzle-orm";

export type CreateFileRow = {
  fileId: string;
  userId: string;
  storagePath: string;
  originalName: string;
  rowCount: number;
  columnHeaders: string[];
};

export const FilesRepository = {
  async create(row: CreateFileRow) {
    const [created] = await db
      .insert(files)
      .values({
        fileId: row.fileId,
        userId: row.userId,
        storagePath: row.storagePath,
        originalName: row.originalName,
        rowCount: row.rowCount,
        columnHeaders: row.columnHeaders as any,
      })
      .returning();
    return created;
  },

  async getByIdForUser(fileId: string, userId: string) {
    const rows = await db
      .select()
      .from(files)
      .where(and(eq(files.fileId, fileId), eq(files.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  },

  async deleteForUser(fileId: string, userId: string) {
    const [deleted] = await db
      .delete(files)
      .where(and(eq(files.fileId, fileId), eq(files.userId, userId)))
      .returning();
    return deleted ?? null;
  },
};



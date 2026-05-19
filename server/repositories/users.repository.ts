import { db } from "../config/database";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export const UsersRepository = {
  async getById(userId: string) {
    const rows = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
    return rows[0] ?? null;
  },

  async create(params: { userId: string; email: string | null }) {
    const [row] = await db
      .insert(users)
      .values({ userId: params.userId, email: params.email ?? "", llmApiKeys: null })
      .returning();
    return row;
  },

  async updateApiKeys(userId: string, encryptedKeys: Record<string, string> | null) {
    await db.update(users).set({ llmApiKeys: encryptedKeys }).where(eq(users.userId, userId));
  },
  
  async deleteById(userId: string) {
    await db.delete(users).where(eq(users.userId, userId));
  },
};



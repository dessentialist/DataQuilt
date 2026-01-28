import { UsersRepository } from "../repositories/users.repository";
import { logInfo } from "@shared/logger";
import { UsersService } from "./users.service";
import { apiKeysSchema } from "@shared/schema";
import { encryptApiKeys, decryptApiKeys } from "@shared/crypto";

export const AuthService = {
  /**
   * Idempotently ensures a user row exists for the authenticated user.
   */
  async syncUser(params: { userId: string; email?: string; requestId?: string }) {
    const { userId, email, requestId } = params;
    logInfo("AuthService.syncUser:start", { userId, requestId });
    const existing = await UsersRepository.getById(userId);
    if (existing) {
      logInfo("AuthService.syncUser:exists", { userId, requestId });
      return existing;
    }
    const created = await UsersService.createUserAndSeed({ userId, email: email ?? null, requestId });
    logInfo("AuthService.syncUser:created", { userId, requestId });
    return created;
  },
  
  async getSession(params: { userId: string; requestId?: string }) {
    const { userId, requestId } = params;
    logInfo("AuthService.getSession:start", { userId, requestId });
    const user = await UsersRepository.getById(userId);
    if (!user) {
      const err: any = new Error("User not found");
      err.code = "AUTH_USER_NOT_FOUND";
      throw err;
    }

    let masked: Record<string, string> | null = null;
    if (user.llmApiKeys) {
      try {
        const decrypted = decryptApiKeys(user.llmApiKeys as Record<string, string>);
        masked = Object.keys(decrypted).reduce((acc, key) => {
          acc[key] = "***masked***";
          return acc;
        }, {} as Record<string, string>);
      } catch {
        // fall through with masked null
      }
    }
    logInfo("AuthService.getSession:success", { userId, requestId });
    return { ...user, llmApiKeys: masked } as const;
  },

  async saveApiKeys(params: { userId: string; input: unknown; requestId?: string }) {
    const { userId, input, requestId } = params;
    logInfo("AuthService.saveApiKeys:start", { userId, requestId });

    // Validate input allowing null for explicit deletions
    const validated = apiKeysSchema.parse(input) as Record<string, string | null | undefined>;

    // Load existing keys (decrypt if present)
    const existingUser = await UsersRepository.getById(userId);
    let currentDecrypted: Record<string, string> = {};
    if (existingUser?.llmApiKeys) {
      try {
        currentDecrypted = decryptApiKeys(existingUser.llmApiKeys as Record<string, string>);
      } catch (e) {
        // If decryption fails, treat as empty to avoid data loss due to corrupt state
        currentDecrypted = {};
      }
    }

    // Merge semantics:
    // - undefined: no change
    // - string trimmed empty: ignore (client shouldn't send, but be defensive)
    // - null: delete key
    // - non-empty string: set/replace
    const next: Record<string, string> = { ...currentDecrypted };
    for (const [provider, value] of Object.entries(validated)) {
      if (value === undefined) continue; // no-op
      if (value === null) {
        delete next[provider];
        continue;
      }
      const trimmed = value.trim();
      if (trimmed === "") continue;
      next[provider] = trimmed;
    }

    // Persist: if empty after merge, store null; else encrypt and store
    const encrypted = Object.keys(next).length > 0 ? encryptApiKeys(next) : null;
    await UsersRepository.updateApiKeys(userId, encrypted);
    logInfo("AuthService.saveApiKeys:success", { userId, providers: Object.keys(next), requestId });
    return { success: true } as const;
  },
};



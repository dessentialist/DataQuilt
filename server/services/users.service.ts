import { UsersRepository } from "../repositories/users.repository";
import { DefaultsSeedingService } from "./defaults.seeding.service";
import { logError, logInfo } from "@shared/logger";

export const UsersService = {
  /**
   * Creates a user row and seeds default templates. Intended for first-time creation paths.
   * Non-blocking seeding: failures are logged but do not prevent user creation.
   */
  async createUserAndSeed(params: { userId: string; email: string | null; requestId?: string }) {
    const { userId, email, requestId } = params;
    logInfo("UsersService.createUserAndSeed:start", { userId, requestId });
    const created = await UsersRepository.create({ userId, email });
    try {
      await DefaultsSeedingService.seedDefaultsForUser({ userId, requestId });
    } catch (e) {
      logError("UsersService.createUserAndSeed:seed_failed", { userId, requestId, error: String(e) });
    }
    logInfo("UsersService.createUserAndSeed:success", { userId, requestId });
    return created;
  },
};



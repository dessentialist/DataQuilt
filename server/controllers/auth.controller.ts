import { Request, Response } from "express";
// Controller delegates to AuthService; keep HTTP-only concerns here
import { apiKeysSchema } from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth";
import { AuthService } from "../services/auth.service";
import { mapErrorToHttp } from "../utils/http-error-map";

export const authController = {
  /**
   * syncUser
   * Idempotently ensures a Supabase-authenticated user exists in our `users` table.
   * Identity is derived from the verified bearer token (middleware), not request body.
   */
  async syncUser(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await AuthService.syncUser({ userId: req.user.userId, email: req.user.email, requestId: req.requestId });
      res.json(user);
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  // No server-side login. Authentication handled by Supabase on the client.

  /**
   * logout
   * Server is stateless for auth; the client calls Supabase to end the session.
   */
  async logout(_req: Request, res: Response) {
    // Supabase client handles session termination; server is stateless for auth
    res.json({ message: "Logged out successfully" });
  },

  /**
   * getSession
   * Returns user row with API keys masked. Requires a valid Supabase token.
   */
  async getSession(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const result = await AuthService.getSession({ userId: req.user.userId, requestId: req.requestId });
      res.json(result);
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  /**
   * saveApiKeys
   * Validates and encrypts user-provided LLM API keys; stores cipher text in DB.
   */
  async saveApiKeys(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      await AuthService.saveApiKeys({ userId: req.user.userId, input: req.body, requestId: req.requestId });
      res.json({ message: "API keys saved successfully" });
    } catch (error) {
      const mapped = mapErrorToHttp(error, { invalidCode: "AUTH_INVALID_INPUT" });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  // No dev login bypass path
};

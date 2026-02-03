import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { AccountDeletionService } from "../services/account.deletion.service";
import { mapErrorToHttp } from "../utils/http-error-map";
import { logInfo, logWarn } from "@shared/logger";

export const accountController = {
  async deleteAccount(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      logInfo("AccountController.deleteAccount:start", {
        path: req.path,
        method: req.method,
        userId: req.user.userId,
        requestId: req.requestId,
      });

      const result = await AccountDeletionService.deleteAccount({
        userId: req.user.userId,
        requestId: req.requestId,
      });

      logInfo("AccountController.deleteAccount:success", {
        userId: req.user.userId,
        requestId: req.requestId,
        userRowDeleted: (result as any)?.userRowDeleted,
        authUserDeleted: (result as any)?.authUserDeleted,
      });

      if (!result.userRowDeleted || !result.authUserDeleted) {
        return res.status(409).json({
          success: false,
          code: "ACCOUNT_DELETE_PARTIAL",
          message: "Partial deletion: one or more resources still present",
          userRowDeleted: result.userRowDeleted,
          authUserDeleted: result.authUserDeleted,
          requestId: req.requestId,
        });
      }

      return res.status(200).json(result);
    } catch (error) {
      logWarn("AccountController.deleteAccount:error", {
        requestId: (req as any)?.requestId,
        userId: (req as any)?.user?.userId,
        error: String(error),
      });
      const mapped = mapErrorToHttp(error);
      return res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },
};



import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { db } from "../config/database";
import { enrichmentJobs, files } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { supabaseService } from "../services/supabase.service";
import { logError } from "@shared/logger";
import { ERROR_CATALOG } from "@shared/errors";
import { HistoryService } from "../services/history.service";
import { mapErrorToHttp } from "../utils/http-error-map";

export const historyController = {
  async listHistory(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }

      const status = (req.query.status as string | undefined)?.trim();
      const limitParam = Number(req.query.limit || 100);
      const result = await HistoryService.listHistory({
        userId: req.user.userId,
        input: { status, limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 100 },
        requestId: req.requestId,
      });
      res.json(result);
    } catch (error) {
      const mapped = mapErrorToHttp(error, { invalidCode: "HISTORY_INVALID_INPUT" });
      logError("history_list_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async deleteJob(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }

      const { jobId } = req.params;
      await HistoryService.deleteJob({ userId: req.user.userId, jobId, requestId: req.requestId });
      res.json({ message: "Job and associated files deleted successfully", requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("history_delete_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },
};

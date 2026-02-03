import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { ERROR_CATALOG } from "@shared/errors";
import { logError } from "@shared/logger";
import { SystemTemplatesService } from "../services/system.templates.service";
import { mapErrorToHttp } from "../utils/http-error-map";

export const systemTemplatesController = {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }
      const rows = await SystemTemplatesService.listSystemTemplates({ userId: req.user.userId, requestId: req.requestId });
      console.log('[SystemTemplatesController] list success', { count: Array.isArray(rows) ? rows.length : 0, requestId: req.requestId });
      res.json(rows);
    } catch (error) {
      logError("system_templates_list_error", { requestId: req.requestId, error: String(error) });
      res.status(ERROR_CATALOG.GENERAL_INTERNAL_ERROR.httpStatus).json({ message: ERROR_CATALOG.GENERAL_INTERNAL_ERROR.defaultMessage, code: "GENERAL_INTERNAL_ERROR", requestId: req.requestId });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }
      const created = await SystemTemplatesService.createSystemTemplate({ userId: req.user.userId, input: req.body, requestId: req.requestId });
      console.log('[SystemTemplatesController] create success', { systemTemplateId: (created as any)?.systemTemplateId, requestId: req.requestId });
      res.json({ ...created, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("system_templates_create_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }
      const { systemTemplateId } = req.params as any;
      const updated = await SystemTemplatesService.updateSystemTemplate({ userId: req.user.userId, systemTemplateId, input: req.body, requestId: req.requestId });
      console.log('[SystemTemplatesController] update success', { systemTemplateId, requestId: req.requestId });
      res.json({ ...updated, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("system_templates_update_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }
      const { systemTemplateId } = req.params as any;
      await SystemTemplatesService.deleteSystemTemplate({ userId: req.user.userId, systemTemplateId, requestId: req.requestId });
      console.log('[SystemTemplatesController] delete success', { systemTemplateId, requestId: req.requestId });
      res.json({ message: "System template deleted successfully", requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("system_templates_delete_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },
};



import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
// Controller delegates to TemplatesService; keep HTTP-only concerns here
import { ERROR_CATALOG } from "@shared/errors";
import { logError } from "@shared/logger";
import { TemplatesService } from "../services/templates.service";
import { mapErrorToHttp } from "../utils/http-error-map";

export const templatesController = {
  async listTemplates(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }

      const templates = await TemplatesService.listTemplates({
        userId: req.user.userId,
        requestId: req.requestId,
      });
      res.json(templates);
    } catch (error) {
      logError("templates_list_error", { requestId: req.requestId, error: String(error) });
      res.status(ERROR_CATALOG.GENERAL_INTERNAL_ERROR.httpStatus).json({
        message: ERROR_CATALOG.GENERAL_INTERNAL_ERROR.defaultMessage,
        code: "GENERAL_INTERNAL_ERROR",
        requestId: req.requestId,
      });
    }
  },

  async createTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }

      const created = await TemplatesService.createTemplate({
        userId: req.user.userId,
        input: req.body,
        requestId: req.requestId,
      });

      res.json({ ...created, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("templates_create_error", {
        requestId: req.requestId,
        error: String(error),
        httpStatus: mapped.status,
      });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async updateTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }

      const { templateId } = req.params;
      try {
        const updated = await TemplatesService.updateTemplate({
          userId: req.user.userId,
          templateId,
          input: req.body,
          requestId: req.requestId,
        });
        res.json({ ...updated, requestId: req.requestId });
      } catch (error) {
        const mapped = mapErrorToHttp(error);
        logError("templates_update_error", {
          requestId: req.requestId,
          error: String(error),
          httpStatus: mapped.status,
        });
        return res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
      }
    } catch (error) {
      logError("templates_update_error", { requestId: req.requestId, error: String(error) });
      res.status(ERROR_CATALOG.GENERAL_INTERNAL_ERROR.httpStatus).json({
        message: ERROR_CATALOG.GENERAL_INTERNAL_ERROR.defaultMessage,
        code: "GENERAL_INTERNAL_ERROR",
        requestId: req.requestId,
      });
    }
  },

  async deleteTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }

      const { templateId } = req.params;
      try {
        await TemplatesService.deleteTemplate({
          userId: req.user.userId,
          templateId,
          requestId: req.requestId,
        });
        res.json({ message: "Template deleted successfully", requestId: req.requestId });
      } catch (error) {
        const mapped = mapErrorToHttp(error);
        logError("templates_delete_error", {
          requestId: req.requestId,
          error: String(error),
          httpStatus: mapped.status,
        });
        return res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
      }
    } catch (error) {
      logError("templates_delete_error", { requestId: req.requestId, error: String(error) });
      res.status(ERROR_CATALOG.GENERAL_INTERNAL_ERROR.httpStatus).json({
        message: ERROR_CATALOG.GENERAL_INTERNAL_ERROR.defaultMessage,
        code: "GENERAL_INTERNAL_ERROR",
        requestId: req.requestId,
      });
    }
  },
};

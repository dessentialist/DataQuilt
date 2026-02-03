import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { jobControlSchema } from "@shared/schema";
import { logError, logInfo } from "@shared/logger";
import { ERROR_CATALOG } from "@shared/errors";
import { JobsService } from "../services/jobs.service";
import { mapErrorToHttp } from "../utils/http-error-map";
import { jobOptionsSchema } from "@shared/schema";

export const jobsController = {
  async createJob(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }
      const result = await JobsService.createJob({
        userId: req.user.userId,
        input: req.body,
        requestId: req.requestId,
      });

      logInfo("job_created", { requestId: req.requestId, jobId: result.jobId, userId: req.user.userId });
      res.json({ jobId: result.jobId, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error, { invalidCode: "JOBS_INVALID_INPUT" });
      // Include activeJobId if available
      const responseBody = {
        ...mapped.body,
        ...(typeof error === "object" && error && (error as any).activeJobId
          ? { activeJobId: (error as any).activeJobId }
          : {}),
        requestId: req.requestId,
      };
      logError("job_create_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json(responseBody);
    }
  },

  async previewJob(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }

      const result = await JobsService.previewJob({
        userId: req.user.userId,
        input: req.body,
        requestId: req.requestId,
      });
      res.json(result);
    } catch (error) {
      const mapped = mapErrorToHttp(error, { invalidCode: "JOBS_INVALID_INPUT" });
      logError("job_preview_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async getJob(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }

      const { jobId } = req.params;
      const result = await JobsService.getJob({ userId: req.user.userId, jobId, requestId: req.requestId });
      res.json(result);
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("get_job_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async controlJob(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }
      const { jobId } = req.params;
      const validated = jobControlSchema.parse(req.body);
      await JobsService.controlJob({ userId: req.user.userId, jobId, command: validated.command, requestId: req.requestId });
      res.status(202).json({ message: `Job ${validated.command} command sent`, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("job_control_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async getDownloadUrl(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }
      const { jobId } = req.params;
      const result = await JobsService.getDownloadUrl({ userId: req.user.userId, jobId, requestId: req.requestId });
      res.json({ ...result, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("job_download_url_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async getLogsDownloadUrl(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }
      const { jobId } = req.params;
      const result = await JobsService.getLogsDownloadUrl({ userId: req.user.userId, jobId, requestId: req.requestId });
      res.json({ ...result, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("job_logs_download_url_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  // Debug endpoint to help troubleshoot active job state sync issues
  async getActiveJobs(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }

      const { activeJobs, recentJobs } = await JobsService.getActiveJobs({ userId: req.user.userId, requestId: req.requestId });
      logInfo("debug_active_jobs_requested", { requestId: req.requestId, userId: req.user.userId, activeJobCount: activeJobs.length, recentJobCount: recentJobs.length, activeJobIds: activeJobs.map(j => j.jobId) });
      res.json({ activeJobs, recentJobs, debug: { userId: req.user.userId, activeJobCount: activeJobs.length, recentJobCount: recentJobs.length, timestamp: new Date().toISOString() }, requestId: req.requestId });
    } catch (error) {
      logError("debug_active_jobs_error", { requestId: req.requestId, error: String(error) });
      res.status(ERROR_CATALOG.GENERAL_INTERNAL_ERROR.httpStatus).json({
        message: ERROR_CATALOG.GENERAL_INTERNAL_ERROR.defaultMessage,
        code: "GENERAL_INTERNAL_ERROR",
        requestId: req.requestId,
      });
    }
  },

  async updateOptions(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }
      const { jobId } = req.params as { jobId: string };
      const opts = jobOptionsSchema.parse(req.body);
      const result = await JobsService.updateOptions({ userId: req.user.userId, jobId, options: opts, requestId: req.requestId });
      res.json({ updated: true, requestId: req.requestId, ...result });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("job_update_options_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async getOptions(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }
      const { jobId } = req.params as { jobId: string };
      const result = await JobsService.getOptions({ userId: req.user.userId, jobId, requestId: req.requestId });
      res.json({ ...result, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("job_get_options_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },
};

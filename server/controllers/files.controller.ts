import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
// Controller refactor: remove direct DB/storage writes; keep multer only
import multer from "multer";
import path from "path";
import { FilesService } from "../services/files.service";
import { logError, logInfo } from "@shared/logger";
import { ERROR_CATALOG } from "@shared/errors";
import { mapErrorToHttp } from "../utils/http-error-map";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Quick client-provided hints; deeper content checks performed later.
    // Do not trust the filename/mimetype entirely, but use them to short-circuit obviously wrong cases.
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.toLowerCase().endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

export const filesController = {
  uploadMiddleware: upload.single("file"),

  async downloadFile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }

      const filePath = decodeURIComponent(req.params.filePath);

      const result = await FilesService.getDownloadUrlForPath({
        userId: req.user.userId,
        filePath,
        requestId: req.requestId,
      });
      res.json({ ...result, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("file_download_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async uploadFile(req: AuthenticatedRequest, res: Response) {
    console.log("SERVER FILES CONTROLLER: uploadFile method called", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      hasUser: !!req.user,
      hasFile: !!req.file,
      timestamp: new Date().toISOString(),
    });

    // Debug context captured for error logs (only used in catch)
    // Use a mutable outer-scope binding so it is available in catch
    let debugContext: {
      userPresent?: boolean;
      hasFile?: boolean;
      fileName?: string | undefined;
      fileSize?: number | undefined;
    } = {
      userPresent: !!req.user,
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
    };

    console.log("SERVER FILES CONTROLLER: Debug context", debugContext);

    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({
          message: spec.defaultMessage,
          code: "AUTH_MISSING_TOKEN",
          requestId: req.requestId,
        });
      }

      if (!req.file) {
        const spec = ERROR_CATALOG.FILES_NO_FILE;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "FILES_NO_FILE", requestId: req.requestId });
      }

      const result = await FilesService.upload({
        userId: req.user.userId,
        file: { buffer: req.file.buffer, originalname: req.file.originalname },
        requestId: req.requestId,
      });

      logInfo("file_uploaded", { requestId: req.requestId, userId: req.user.userId, fileId: result.fileId });
      res.json(result);
    } catch (error) {
      const mapped = mapErrorToHttp(error, { invalidCode: "FILES_INVALID_INPUT" });
      logError("file_upload_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status, ...debugContext });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async downloadById(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }
      const { fileId } = req.params as { fileId: string };
      const result = await FilesService.getDownloadUrlById({ userId: req.user.userId, fileId, requestId: req.requestId });
      return res.json({ ...result, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("file_download_by_id_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      return res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },

  async previewFile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
        return res.status(spec.httpStatus).json({ message: spec.defaultMessage, code: "AUTH_MISSING_TOKEN", requestId: req.requestId });
      }

      const { fileId } = req.params as { fileId: string };
      logInfo("FilesController.previewFile:start", { userId: req.user.userId, fileId, requestId: req.requestId });

      const { previewData } = await FilesService.previewFirstRows({ userId: req.user.userId, fileId, limit: 5, requestId: req.requestId });
      logInfo("FilesController.previewFile:success", { userId: req.user.userId, fileId, rowCount: previewData.length, requestId: req.requestId });
      res.json({ previewData, requestId: req.requestId });
    } catch (error) {
      const mapped = mapErrorToHttp(error);
      logError("file_preview_error", { requestId: req.requestId, error: String(error), httpStatus: mapped.status });
      res.status(mapped.status).json({ ...mapped.body, requestId: req.requestId });
    }
  },
};

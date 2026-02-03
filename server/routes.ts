import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  authenticateSupabaseUser,
  verifySupabaseTokenOnly,
  AuthenticatedRequest,
} from "./middleware/auth";
import { authController } from "./controllers/auth.controller";
import { filesController } from "./controllers/files.controller";
import { jobsController } from "./controllers/jobs.controller";
import { templatesController } from "./controllers/templates.controller";
import { historyController } from "./controllers/history.controller";
import { systemTemplatesController } from "./controllers/system.templates.controller";
import { healthController } from "./controllers/health.controller";
import { accountController } from "./controllers/account.controller";

export async function registerRoutes(app: Express): Promise<Server> {
  // Enhanced health check endpoint (no authentication required)
  app.get("/api/health", healthController.getHealthCheck.bind(healthController));

  // Authentication routes
  // Note: Auth is handled via Supabase on the client. Server only syncs/fetches data for an authenticated user.
  // Allow sync to run with a valid Supabase token even if the user row doesn't exist yet
  app.post("/api/auth/sync", verifySupabaseTokenOnly, authController.syncUser);
  app.post("/api/auth/logout", authController.logout);
  app.get("/api/auth/session", authenticateSupabaseUser, authController.getSession);
  app.post("/api/auth/keys", authenticateSupabaseUser, authController.saveApiKeys);

  // Development route (only in development)
  // No server-side login bypass; authentication is handled solely by Supabase

  // File management routes with comprehensive logging
  app.post(
    "/api/files/upload",
    (req, res, next) => {
      console.log("ROUTES: /api/files/upload endpoint hit", {
        method: req.method,
        path: req.path,
        hasBody: !!req.body,
        contentType: req.headers["content-type"],
        contentLength: req.headers["content-length"],
        hasAuthHeader: !!req.headers.authorization,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
      next();
    },
    authenticateSupabaseUser,
    (req: AuthenticatedRequest, res, next) => {
      console.log("ROUTES: After auth middleware", {
        hasUser: !!req.user,
        userId: req.user?.userId,
        requestId: req.requestId,
      });
      next();
    },
    filesController.uploadMiddleware,
    (req: AuthenticatedRequest, res, next) => {
      console.log("ROUTES: After multer middleware", {
        hasFile: !!req.file,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        requestId: req.requestId,
      });
      next();
    },
    filesController.uploadFile,
  );
  // Return signed URL instead of raw file bytes; controller enforces ownership via service
  app.get("/api/files/download/:filePath", authenticateSupabaseUser, filesController.downloadFile);
  // New id-based route for downloads
  app.get("/api/files/:fileId/download", authenticateSupabaseUser, filesController.downloadById);
  // Preview route to get first few rows of CSV data
  app.get("/api/files/:fileId/preview", authenticateSupabaseUser, filesController.previewFile);

  // Job processing routes
  app.post("/api/jobs", authenticateSupabaseUser, jobsController.createJob);
  app.post("/api/jobs/preview", authenticateSupabaseUser, jobsController.previewJob);
  app.get("/api/jobs/:jobId", authenticateSupabaseUser, jobsController.getJob);
  app.post("/api/jobs/:jobId/control", authenticateSupabaseUser, jobsController.controlJob);
  app.patch("/api/jobs/:jobId/options", authenticateSupabaseUser, jobsController.updateOptions);
  app.get("/api/jobs/:jobId/options", authenticateSupabaseUser, jobsController.getOptions);
  app.get("/api/jobs/:jobId/download", authenticateSupabaseUser, jobsController.getDownloadUrl);
  app.get("/api/jobs/:jobId/logs", authenticateSupabaseUser, jobsController.getLogsDownloadUrl);
  
  // Debug endpoint to check for active jobs
  app.get("/api/debug/active-jobs", authenticateSupabaseUser, jobsController.getActiveJobs);

  // Template management routes
  app.get("/api/templates", authenticateSupabaseUser, templatesController.listTemplates);
  app.post("/api/templates", authenticateSupabaseUser, templatesController.createTemplate);
  app.put(
    "/api/templates/:templateId",
    authenticateSupabaseUser,
    templatesController.updateTemplate,
  );
  app.delete(
    "/api/templates/:templateId",
    authenticateSupabaseUser,
    templatesController.deleteTemplate,
  );

  // System template management routes
  app.get("/api/system-templates", authenticateSupabaseUser, systemTemplatesController.list);
  app.post("/api/system-templates", authenticateSupabaseUser, systemTemplatesController.create);
  app.put("/api/system-templates/:systemTemplateId", authenticateSupabaseUser, systemTemplatesController.update);
  app.delete("/api/system-templates/:systemTemplateId", authenticateSupabaseUser, systemTemplatesController.delete);

  // History routes
  app.get("/api/history", authenticateSupabaseUser, historyController.listHistory);
  app.delete("/api/history/:jobId", authenticateSupabaseUser, historyController.deleteJob);

  // Account deletion
  app.delete("/api/account", authenticateSupabaseUser, accountController.deleteAccount);

  const httpServer = createServer(app);
  return httpServer;
}

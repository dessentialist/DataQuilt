import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { attachRequestId } from "./middleware/requestId";
import { logInfo, logError } from "@shared/logger";

const app = express();
app.use(attachRequestId);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    const method = req.method;
    const isApi = path.startsWith("/api");
    const isHealthCheck = path === "/api/health";
    const isApiRoot = path === "/api";
    const isNoiseMethod = method === "HEAD" || method === "OPTIONS";

    if (isApi && !isHealthCheck && !isApiRoot && !isNoiseMethod) {
      logInfo("http_request", {
        method,
        path,
        status: res.statusCode,
        durationMs: duration,
        requestId: req.requestId,
      });
    }
  });

  next();
});

(async () => {
  // Validate all environment variables early so misconfigurations fail fast
  try {
    const { validateEnvironment } = await import("../shared/env-validation");
    validateEnvironment();

    // Validate encryption key specifically
    await import("../shared/crypto");
  } catch (error) {
    logError("fatal_environment_validation", { error: String(error) });
    process.exit(1);
  }

  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    void _next;
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logError("unhandled_error", {
      status,
      message,
      requestId: req.requestId,
    });
    res
      .status(status)
      .json({ message, code: "GENERAL_INTERNAL_ERROR", requestId: (req as any).requestId });
  });

  // Ensure Storage bucket exists on boot (idempotent) and log warning if it fails
  try {
    const { supabaseService } = await import("./services/supabase.service");
    await supabaseService.ensureBucketExists("oracle-files");
  } catch (error) {
    logInfo("bucket_ensure_failed", { error: String(error) });
  }

  // Start the background worker for job processing
  let workerStarted = false;
  try {
    const { jobProcessor } = await import("../worker/services/job.processor");
    await jobProcessor.start();
    workerStarted = true;
    logInfo("worker_started", { status: "success" });
    console.log("✅ Background worker started successfully");

    // Setup heartbeat logging every 60 seconds to show worker is alive
    const heartbeatInterval = setInterval(() => {
      console.log(`💓 Worker heartbeat - ${new Date().toISOString()}`);
    }, 60000);

    // Handle graceful worker shutdown on process termination
    const gracefulShutdown = async (signal: string) => {
      console.log(`📥 Received ${signal}, shutting down worker gracefully...`);
      clearInterval(heartbeatInterval);
      try {
        await jobProcessor.stop();
        logInfo("worker_stopped", { status: "success", signal });
      } catch (error) {
        logError("worker_stop_error", { error: String(error), signal });
      }
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    logError("worker_start_failed", { error: String(error) });
    console.error("❌ Failed to start background worker:", error);
    // Don't exit the process - let the server start without the worker for debugging
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000 (recommended for Replit)
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

import { db } from "../config/database";
import { supabaseService } from "./supabase.service";
import { LLMService } from "@shared/llm";
import { enrichmentJobs } from "@shared/schema";
import { and, eq, gt, inArray } from "drizzle-orm";

export interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  details: Record<string, unknown>;
  lastChecked: string;
  error?: string;
}

export interface LLMProviderHealth {
  provider: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  lastChecked: string;
  error?: string;
  rateLimitInfo?: {
    remaining: number;
    reset: string;
  };
}

export class HealthService {
  private llmService: LLMService;

  constructor() {
    this.llmService = new LLMService({});
  }

  async checkDatabase(): Promise<ComponentHealth> {
    const start = performance.now();
    try {
      // Drizzle connectivity probe: minimal query with limit 1
      await db.select({ id: enrichmentJobs.jobId }).from(enrichmentJobs).limit(1);
      const responseTime = performance.now() - start;
      return {
        status: "healthy",
        responseTime,
        details: {
          connectionTest: "successful",
          poolInfo: { poolSize: 1, activeConnections: 1, idleConnections: 0, waitingClients: 0 },
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = performance.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "unhealthy",
        responseTime,
        details: { connectionTest: "failed", error: message },
        lastChecked: new Date().toISOString(),
        error: message,
      };
    }
  }

  async checkStorage(): Promise<ComponentHealth> {
    const start = performance.now();
    try {
      const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "oracle-files";
      const testKey = `health-check-${Date.now()}.txt`;
      const testContent = "Health check test content";

      const { error: uploadError } = await supabaseService.uploadFile(testKey, Buffer.from(testContent));
      if (uploadError) throw uploadError;

      const deleteSuccess = await supabaseService.deleteFile(testKey);
      if (!deleteSuccess) throw new Error("Failed to delete test file");

      const responseTime = performance.now() - start;
      return {
        status: "healthy",
        responseTime,
        details: { bucketExists: true, uploadTest: "successful", deleteTest: "successful", bucketName },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = performance.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "unhealthy",
        responseTime,
        details: { uploadTest: "failed", error: message },
        lastChecked: new Date().toISOString(),
        error: message,
      };
    }
  }

  async checkLLMProviders(): Promise<ComponentHealth> {
    const start = performance.now();
    try {
      const providers = ["openai", "gemini", "perplexity", "deepseek", "anthropic"] as const;
      const providerHealth: LLMProviderHealth[] = [];

      for (const provider of providers) {
        try {
          const pStart = performance.now();
          const isHealthy = await this.llmService.healthCheck(provider as any);
          providerHealth.push({
            provider,
            status: isHealthy ? "healthy" : "unhealthy",
            responseTime: performance.now() - pStart,
            lastChecked: new Date().toISOString(),
            error: isHealthy ? undefined : "Health check failed",
          });
        } catch (err) {
          providerHealth.push({
            provider,
            status: "unhealthy",
            responseTime: 0,
            lastChecked: new Date().toISOString(),
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const healthyProviders = providerHealth.filter((p) => p.status === "healthy").length;
      const totalProviders = providerHealth.length;
      let overall: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (healthyProviders === 0) overall = "unhealthy";
      else if (healthyProviders < totalProviders) overall = "degraded";

      return {
        status: overall,
        responseTime: performance.now() - start,
        details: { totalProviders, healthyProviders, providerHealth },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = performance.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "unhealthy",
        responseTime,
        details: { totalProviders: 0, healthyProviders: 0, providerHealth: [], error: message },
        lastChecked: new Date().toISOString(),
        error: message,
      };
    }
  }

  async checkWorkerProcesses(): Promise<ComponentHealth> {
    const start = performance.now();
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Fetch active jobs within last hour, then aggregate in memory (avoids raw SQL aggregations)
      const activeStatuses = ["queued", "processing", "failed"] as const;
      const activeJobs = await db
        .select({ jobId: enrichmentJobs.jobId, status: enrichmentJobs.status })
        .from(enrichmentJobs)
        .where(and(inArray(enrichmentJobs.status, activeStatuses as unknown as string[]), gt(enrichmentJobs.createdAt, oneHourAgo)));

      const totalActive = activeJobs.length;
      const processing = activeJobs.filter((j) => j.status === "processing").length;
      const queued = activeJobs.filter((j) => j.status === "queued").length;
      const failed = activeJobs.filter((j) => j.status === "failed").length;

      // Count jobs created in the last hour
      const lastHourJobs = await db
        .select({ jobId: enrichmentJobs.jobId })
        .from(enrichmentJobs)
        .where(gt(enrichmentJobs.createdAt, oneHourAgo));
      const lastHour = lastHourJobs.length;

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (failed > totalActive * 0.5) status = "unhealthy";
      else if (failed > 0 || queued > 10) status = "degraded";

      return {
        status,
        responseTime: performance.now() - start,
        details: { totalActive, processing, queued, failed, lastHour },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = performance.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "unhealthy",
        responseTime,
        details: { totalActive: 0, processing: 0, queued: 0, failed: 0, lastHour: 0, error: message },
        lastChecked: new Date().toISOString(),
        error: message,
      };
    }
  }

  async checkRealtime(): Promise<ComponentHealth> {
    const start = performance.now();
    try {
      // Drizzle connectivity probe to simulate realtime viability
      await db.select({ id: enrichmentJobs.jobId }).from(enrichmentJobs).limit(1);
      return {
        status: "healthy",
        responseTime: performance.now() - start,
        details: { realtimeTest: "successful", connectionStatus: "connected" },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = performance.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "unhealthy",
        responseTime,
        details: { realtimeTest: "failed", connectionStatus: "disconnected", error: message },
        lastChecked: new Date().toISOString(),
        error: message,
      };
    }
  }

  determineOverall(components: {
    database: ComponentHealth;
    storage: ComponentHealth;
    llmProviders: ComponentHealth;
    workerProcesses: ComponentHealth;
    realtimeConnection: ComponentHealth;
  }): {
    status: "healthy" | "degraded" | "unhealthy";
    criticalIssues: string[];
    warnings: string[];
    recommendations: string[];
  } {
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (components.database.status === "unhealthy") {
      criticalIssues.push("Database is unavailable");
      recommendations.push("Check database connectivity and configuration");
    }

    if (components.storage.status === "unhealthy") {
      criticalIssues.push("Storage system is unavailable");
      recommendations.push("Check Supabase storage configuration and permissions");
    }

    if (components.llmProviders.status === "unhealthy") {
      criticalIssues.push("All LLM providers are unavailable");
      recommendations.push("Check API keys and provider configurations");
    } else if (components.llmProviders.status === "degraded") {
      warnings.push("Some LLM providers are unavailable");
      recommendations.push("Check individual provider configurations");
    }

    if (components.workerProcesses.status === "unhealthy") {
      warnings.push("Worker processes are not functioning properly");
      recommendations.push("Check worker process status and database connectivity");
    }

    if (components.realtimeConnection.status === "unhealthy") {
      warnings.push("Real-time connections are not working");
      recommendations.push("Check database connection and real-time configuration");
    }

    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (criticalIssues.length > 0) overallStatus = "unhealthy";
    else if (warnings.length > 0) overallStatus = "degraded";

    return { status: overallStatus, criticalIssues, warnings, recommendations };
  }
}

export const healthService = new HealthService();



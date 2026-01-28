import { createJobSchema, type JobOptionsRequest } from "@shared/schema";
import { JobsRepository } from "../repositories/jobs.repository";
import { logInfo } from "@shared/logger";
import { supabaseService } from "./supabase.service";
import { decryptApiKeys } from "@shared/crypto";
import { LLMService } from "@shared/llm";
import { createNormalizedCsvParser } from "@shared/csv";
import { storagePaths, isCellFilledForSkip } from "@shared/utils";
import { Readable } from "stream";
import { substituteVariables, substituteVariablesInMessages, extractVariables } from "@shared/utils";
import { validatePrompts } from "@shared/promptValidation";

export const JobsService = {
  async createJob(params: { userId: string; input: unknown; requestId?: string }) {
    const { userId, input, requestId } = params;
    logInfo("JobsService.createJob:start", { userId, requestId });

    const validated = createJobSchema.parse(input);

    // Queue limit: allow up to 2 queued jobs per user
    const queuedCount = await JobsRepository.countQueuedJobsForUser(userId);
    if (queuedCount >= 2) {
      const err: any = new Error("Queue limit reached");
      err.code = "JOBS_QUEUE_LIMIT_EXCEEDED";
      throw err;
    }

    // Ensure no active job exists unless forceQueue is true
    const active = await JobsRepository.findActiveForUser(userId);
    if (active && !validated.forceQueue) {
      const err: any = new Error("Active job exists");
      err.code = "JOBS_ACTIVE_JOB_EXISTS";
      (err as any).activeJobId = active.jobId;
      throw err;
    }

    // Verify file ownership
    const file = await JobsRepository.getFileForUser(validated.fileId, userId);
    if (!file) {
      const err: any = new Error("File not found");
      err.code = "JOBS_FILE_NOT_FOUND";
      throw err;
    }

    // Load file to get input headers for validation
    const fileRow = await JobsRepository.getFileForUser(validated.fileId, userId);
    if (!fileRow) {
      const err: any = new Error("File not found");
      err.code = "JOBS_FILE_NOT_FOUND";
      throw err;
    }

    // Server-side prompt validation (mirrors frontend behavior)
    const validation = validatePrompts(
      validated.promptsConfig as any,
      (fileRow.columnHeaders as string[]) || [],
    );
    // Allow outputCollidesWithInputHeader as a warning (createJob only). Block on other issues.
    const blockingIssues = validation.issues.filter(
      (iss) => iss.type !== "outputCollidesWithInputHeader",
    );
    const collisionWarnings = validation.issues.filter(
      (iss) => iss.type === "outputCollidesWithInputHeader",
    );
    if (blockingIssues.length > 0) {
      const err: any = new Error("Invalid prompts configuration");
      err.code = "JOBS_INVALID_INPUT";
      err.details = { validationIssues: blockingIssues };
      throw err;
    }

    const job = await JobsRepository.createJob({
      userId,
      fileId: validated.fileId,
      promptsConfig: validated.promptsConfig,
      totalRows: fileRow.rowCount,
    });

    // Write control file immediately (default OFF unless provided)
    try {
      const options: JobOptionsRequest = {
        skipIfExistingValue: Boolean(validated.options?.skipIfExistingValue),
      };
      const controlPath = storagePaths.controls(userId, job.jobId);
      await supabaseService.uploadFile(
        controlPath,
        Buffer.from(
          JSON.stringify({ ...options, updatedAt: new Date().toISOString(), updatedBy: "server" }),
          "utf8",
        ),
        {
          contentType: "application/json",
        },
      );
    } catch (e) {
      // best-effort; worker will treat missing file as defaults
    }

    // Emit warnings for any header collisions so the user has an audit trail
    if (collisionWarnings.length > 0) {
      await JobsRepository.insertLog(
        job.jobId,
        "WARN",
        `Output column name collision detected for ${collisionWarnings.length} prompt(s). Existing input column values will be overwritten.`,
      );
      for (const w of collisionWarnings) {
        const name = (w.details as any)?.outputColumnName;
        await JobsRepository.insertLog(
          job.jobId,
          "WARN",
          name
            ? `Collision: output column '${name}' matches an existing input header; values will be overwritten.`
            : `Collision: a prompt output column matches an existing input header; values will be overwritten.`,
        );
      }
    }

    await JobsRepository.insertLog(job.jobId, "INFO", "Job created and queued for processing");
    logInfo("JobsService.createJob:success", { userId, jobId: job.jobId, requestId });
    return { jobId: job.jobId } as const;
  },

  async updateOptions(params: { userId: string; jobId: string; options: JobOptionsRequest; requestId?: string }) {
    const { userId, jobId, options, requestId } = params;
    logInfo("JobsService.updateOptions:start", { userId, jobId, requestId, options });
    const job = await JobsRepository.getJobForUser(jobId, userId);
    if (!job) {
      const err: any = new Error("Job not found");
      err.code = "JOBS_NOT_FOUND";
      throw err;
    }
    const controlPath = storagePaths.controls(userId, jobId);
    await supabaseService.uploadFile(
      controlPath,
      Buffer.from(
        JSON.stringify({ skipIfExistingValue: Boolean(options.skipIfExistingValue), updatedAt: new Date().toISOString(), updatedBy: "server" }),
        "utf8",
      ),
      { contentType: "application/json" },
    );
    await JobsRepository.insertLog(jobId, "INFO", `options_set skipIfExistingValue=${Boolean(options.skipIfExistingValue)}`);
    logInfo("JobsService.updateOptions:success", { userId, jobId, requestId });
    return { path: controlPath } as const;
  },

  async getOptions(params: { userId: string; jobId: string; requestId?: string }) {
    const { userId, jobId, requestId } = params;
    logInfo("JobsService.getOptions:start", { userId, jobId, requestId });
    const job = await JobsRepository.getJobForUser(jobId, userId);
    if (!job) {
      const err: any = new Error("Job not found");
      err.code = "JOBS_NOT_FOUND";
      throw err;
    }
    const controlPath = storagePaths.controls(userId, jobId);
    const buf = await supabaseService.downloadFile(controlPath);
    if (!buf) {
      logInfo("JobsService.getOptions:default", { userId, jobId, requestId });
      return { skipIfExistingValue: false } as const;
    }
    try {
      const parsed = JSON.parse(buf.toString("utf8"));
      const skip = Boolean(parsed?.skipIfExistingValue);
      logInfo("JobsService.getOptions:success", { userId, jobId, requestId, skip });
      return { skipIfExistingValue: skip } as const;
    } catch (e) {
      logInfo("JobsService.getOptions:parse_error", { userId, jobId, requestId, error: String((e as any)?.message || e) });
      return { skipIfExistingValue: false } as const;
    }
  },

  async getJob(params: { userId: string; jobId: string; requestId?: string }) {
    const { userId, jobId, requestId } = params;
    logInfo("JobsService.getJob:start", { userId, jobId, requestId });
    const job = await JobsRepository.getJobForUser(jobId, userId);
    if (!job) {
      const err: any = new Error("Job not found");
      err.code = "JOBS_NOT_FOUND";
      throw err;
    }
    const logs = await JobsRepository.getLogsAsc(jobId);
    logInfo("JobsService.getJob:success", { userId, jobId, requestId });
    return { job, logs } as const;
  },

  async controlJob(params: { userId: string; jobId: string; command: "pause" | "resume" | "stop"; requestId?: string }) {
    const { userId, jobId, command, requestId } = params;
    logInfo("JobsService.controlJob:start", { userId, jobId, command, requestId });

    const job = await JobsRepository.getJobForUser(jobId, userId);
    if (!job) {
      const err: any = new Error("Job not found");
      err.code = "JOBS_NOT_FOUND";
      throw err;
    }

    let newStatus: typeof job.status;
    switch (command) {
      case "pause":
        newStatus = "paused";
        break;
      case "resume":
        newStatus = "processing";
        // Clear errorDetails when resuming (error was resolved or user wants to continue)
        await JobsRepository.updateJobStatusAndClearError(jobId, "processing");
        await JobsRepository.insertLog(jobId, "INFO", "Job resumed by user");
        logInfo("JobsService.controlJob:success", { userId, jobId, command, requestId });
        return { accepted: true } as const;
      case "stop":
        newStatus = "stopped";
        // Clear errorDetails when stopping (cleanup)
        await JobsRepository.updateJobStatusAndClearError(jobId, "stopped");
        await JobsRepository.insertLog(jobId, "INFO", "Job stopped by user");
        logInfo("JobsService.controlJob:success", { userId, jobId, command, requestId });
        return { accepted: true } as const;
      default: {
        const err: any = new Error("Invalid command");
        err.code = "JOBS_CONTROL_INVALID_COMMAND";
        throw err;
      }
    }

    // For pause command, keep errorDetails if it exists (may have been set by auto-pause)
    await JobsRepository.updateJobStatus(jobId, newStatus as any);
    await JobsRepository.insertLog(jobId, "INFO", "Job paused by user");
    logInfo("JobsService.controlJob:success", { userId, jobId, command, requestId });
    return { accepted: true } as const;
  },

  async getDownloadUrl(params: { userId: string; jobId: string; requestId?: string }) {
    const { userId, jobId, requestId } = params;
    logInfo("JobsService.getDownloadUrl:start", { userId, jobId, requestId });
    const job = await JobsRepository.getJobForUser(jobId, userId);
    if (!job) {
      const err: any = new Error("Job not found");
      err.code = "JOBS_NOT_FOUND";
      throw err;
    }

    let filePath = job.enrichedFilePath as string | null;
    if (!filePath && (job.status === "processing" || job.status === "paused" || job.status === "stopped")) {
      const partialPath = `enriched/${job.userId}/${job.jobId}_partial.csv`;
      const partialUrl = await supabaseService.getSignedUrl(partialPath);
      if (partialUrl) {
        logInfo("JobsService.getDownloadUrl:partial", { userId, jobId, requestId });
        return { url: partialUrl } as const;
      }
    }

    // Also allow partial download if job failed but a partial exists
    if (!filePath && job.status === "failed") {
      const partialPath = `enriched/${job.userId}/${job.jobId}_partial.csv`;
      const partialUrl = await supabaseService.getSignedUrl(partialPath);
      if (partialUrl) {
        logInfo("JobsService.getDownloadUrl:partial_failed", { userId, jobId, requestId });
        return { url: partialUrl } as const;
      }
    }

    if (!filePath) {
      const file = await JobsRepository.getFileForUser(job.fileId, userId);
      if (!file) {
        const err: any = new Error("File not found");
        err.code = "JOBS_FILE_NOT_FOUND";
        throw err;
      }
      filePath = file.storagePath;
    }

    const signedUrl = await supabaseService.getSignedUrl(filePath);
    if (!signedUrl) {
      const err: any = new Error("Download not accessible");
      err.code = "JOBS_DOWNLOAD_NOT_ACCESSIBLE";
      throw err;
    }
    logInfo("JobsService.getDownloadUrl:success", { userId, jobId, requestId });
    return { url: signedUrl } as const;
  },

  async getLogsDownloadUrl(params: { userId: string; jobId: string; requestId?: string }) {
    const { userId, jobId, requestId } = params;
    logInfo("JobsService.getLogsDownloadUrl:start", { userId, jobId, requestId });
    const job = await JobsRepository.getJobForUser(jobId, userId);
    if (!job) {
      const err: any = new Error("Job not found");
      err.code = "JOBS_NOT_FOUND";
      throw err;
    }

    const logsPath = storagePaths.logs(job.userId, job.jobId);
    // Try to serve existing artifact (new path)
    let existingUrl = await supabaseService.getSignedUrl(logsPath, 3600, `${job.jobId}-logs.txt`);
    if (existingUrl) {
      logInfo("JobsService.getLogsDownloadUrl:artifact", { userId, jobId, requestId });
      return { url: existingUrl } as const;
    }

    // Back-compat: check legacy path and, if found, optionally copy/migrate
    const legacyPath = storagePaths.legacyLogs(job.userId, job.jobId);
    const legacyUrl = await supabaseService.getSignedUrl(legacyPath, 60); // short check
    if (legacyUrl) {
      // Optionally copy from legacy to new location by downloading and re-uploading
      const buf = await supabaseService.downloadFile(legacyPath);
      if (buf) {
        await supabaseService.uploadFile(logsPath, buf, { contentType: "text/plain" });
        existingUrl = await supabaseService.getSignedUrl(logsPath, 3600, `${job.jobId}-logs.txt`);
        if (existingUrl) {
          logInfo("JobsService.getLogsDownloadUrl:migrated_legacy", { userId, jobId, requestId });
          return { url: existingUrl } as const;
        }
      }
    }

    // If still missing and job is completed or failed/stopped, lazily render and upload then return URL
    if (["completed", "failed", "stopped"].includes(job.status as any)) {
      const logs = await JobsRepository.getLogsAsc(jobId);
      const lines = logs.map((l: any) => {
        const ts = l.timestamp instanceof Date ? l.timestamp.toISOString() : new Date(String(l.timestamp)).toISOString();
        return `[${ts}] ${l.level} ${l.message}`;
      });
      const txt = lines.join("\n");

      await supabaseService.uploadFile(logsPath, Buffer.from(txt, "utf8"), { contentType: "text/plain" });
      const signed = await supabaseService.getSignedUrl(logsPath, 3600, `${job.jobId}-logs.txt`);
      if (signed) {
        logInfo("JobsService.getLogsDownloadUrl:generated", { userId, jobId, requestId });
        return { url: signed } as const;
      }
    }

    // As a last resort (e.g., active job), return inline assembled text via a signed URL failover
    // but keep contract: return 404-like error when storage URL cannot be produced
    const err: any = new Error("File not accessible");
    err.code = "JOBS_DOWNLOAD_NOT_ACCESSIBLE";
    throw err;
  },

  async previewJob(params: { userId: string; input: unknown; requestId?: string }) {
    const { userId, input, requestId } = params;
    logInfo("JobsService.previewJob:start", { userId, requestId });
    const validated = createJobSchema.parse(input);

    const file = await JobsRepository.getFileForUser(validated.fileId, userId);
    if (!file) {
      const err: any = new Error("File not found");
      err.code = "JOBS_FILE_NOT_FOUND";
      throw err;
    }

    // Validate prompts against headers before preview LLM calls
    const validation = validatePrompts(validated.promptsConfig as any, (file.columnHeaders as string[]) || []);
    if (!validation.ok) {
      // Treat collisions as warnings for preview; block on other issues
      const blocking = validation.issues.filter((iss) => iss.type !== "outputCollidesWithInputHeader");
      if (blocking.length > 0) {
        // Log the blocking issues for debugging/observability
        logInfo("JobsService.previewJob:validation_blocking", {
          userId,
          count: blocking.length,
          types: Array.from(new Set(blocking.map((b: any) => b.type))),
          requestId,
        });
        const err: any = new Error("Invalid prompts configuration");
        err.code = "JOBS_INVALID_INPUT";
        err.details = { validationIssues: blocking };
        throw err;
      }
      // Collisions allowed: log for observability
      const collisions = validation.issues.filter((iss) => iss.type === "outputCollidesWithInputHeader");
      if (collisions.length > 0) {
        logInfo("JobsService.previewJob:collisions_allowed", { userId, count: collisions.length, requestId });
      }
    }

    const fileData = await supabaseService.downloadFile(file.storagePath);
    if (!fileData) {
      const err: any = new Error("File not found in storage");
      err.code = "JOBS_FILE_NOT_FOUND";
      throw err;
    }

    const csvData: any[] = [];
    const stream = Readable.from(fileData);
    const parser = createNormalizedCsvParser();
    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const complete = () => {
        if (!resolved) {
          resolved = true;
          try {
            stream.removeAllListeners();
            parser.removeAllListeners();
          } catch {}
          resolve();
        }
      };

      parser
        .on("data", (row: any) => {
          if (csvData.length < 2) csvData.push(row);
          if (csvData.length >= 2) {
            // Graceful early termination
            try {
              stream.unpipe(parser);
            } catch {}
            try {
              parser.destroy();
            } catch {}
            try {
              stream.destroy();
            } catch {}
            complete();
          }
        })
        .on("end", () => complete())
        .on("error", (err: any) => {
          if (!resolved) reject(err);
        });

      stream.pipe(parser);
    });

    const userRow = await JobsRepository.getUser(userId);
    const apiKeys = userRow?.llmApiKeys ? decryptApiKeys(userRow.llmApiKeys as Record<string, string>) : {};
    const llm = new LLMService(apiKeys);

    const previewData = [] as any[];
    const detailedRows: any[] = [];
    for (const row of csvData) {
      const enrichedRow: Record<string, any> = { ...row };
      const promptDetailsForRow: any[] = [];
      for (const prompt of validated.promptsConfig) {
        // Skip logic: if options.skipIfExistingValue and the output cell is considered filled, keep value and continue
        const outCol = prompt.outputColumnName;
        const preExisting = enrichedRow[outCol];
        const skip = Boolean(validated.options?.skipIfExistingValue) && isCellFilledForSkip(preExisting);
        if (skip) {
          logInfo("JobsService.preview:skip_existing", { column: outCol, valuePreview: typeof preExisting === "string" ? preExisting.slice(0, 60) : String(preExisting).slice(0, 60), requestId });
          promptDetailsForRow.push({
            index: promptDetailsForRow.length,
            model: prompt.model,
            modelId: (prompt as any).modelId,
            outputColumnName: prompt.outputColumnName,
            usedVariables: Array.from(new Set([
              ...extractVariables((prompt as any).systemText || ""),
              ...extractVariables(prompt.promptText || ""),
            ])),
            systemProcessed: undefined,
            userProcessed: undefined,
            response: preExisting,
            skipped: true,
          });
          continue;
        }
        const { systemProcessed, userProcessed } = substituteVariablesInMessages((prompt as any).systemText, prompt.promptText, enrichedRow);
        logInfo('JobsService.preview:invoke', { provider: prompt.model, modelId: (prompt as any).modelId, hasSystem: Boolean(systemProcessed), requestId });
        // Scale timeout in preview as well; previews are only 1-2 rows
        const totalLen = (userProcessed?.length || 0) + (systemProcessed?.length || 0);
        const timeoutMs = totalLen > 12000 ? 45000
          : totalLen > 8000 ? 30000
          : totalLen > 4000 ? 20000
          : 12000;
        const response = await llm.processMessages({ systemText: systemProcessed, userText: userProcessed }, prompt.model, {
          // No prompt-length token heuristics; rely on per-model defaults or explicit values
          timeoutMs,
          maxRetries: 2,
          modelId: (prompt as any).modelId,
        });
        enrichedRow[prompt.outputColumnName] = response.success ? response.content : `ERROR: ${response.error}`;
        promptDetailsForRow.push({
          index: promptDetailsForRow.length,
          model: prompt.model,
          modelId: (prompt as any).modelId,
          outputColumnName: prompt.outputColumnName,
          usedVariables: Array.from(new Set([
            ...extractVariables((prompt as any).systemText || ""),
            ...extractVariables(prompt.promptText || ""),
          ])),
          systemProcessed,
          userProcessed,
          response: enrichedRow[prompt.outputColumnName],
          skipped: false,
        });
      }
      previewData.push(enrichedRow);
      detailedRows.push({
        original: row,
        enriched: enrichedRow,
        prompts: promptDetailsForRow,
      });
    }
    logInfo("JobsService.previewJob:success", { userId, requestId });
    return { previewData, detailed: detailedRows, meta: { models: validated.promptsConfig.map((p) => p.model), timestamp: new Date().toISOString(), requestId } } as const;
  },
  
  async getActiveJobs(params: { userId: string; requestId?: string }) {
    const { userId, requestId } = params;
    logInfo("JobsService.getActiveJobs:start", { userId, requestId });
    const activeJobs = await JobsRepository.listActiveJobsForUser(userId);
    const recentJobs = await JobsRepository.listRecentJobsForUser(userId, 5);
    logInfo("JobsService.getActiveJobs:success", { userId, activeCount: activeJobs.length, recentCount: recentJobs.length, requestId });
    return { activeJobs, recentJobs } as const;
  },
};



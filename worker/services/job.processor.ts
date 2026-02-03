import "dotenv/config";
import { db, supabaseService } from "../lib/supabase";
import { enrichmentJobs, jobLogs, files, users } from "@shared/schema";
import { eq, and, lt, or, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { LLMService } from "./llm.service";
import { createNormalizedCsvParser } from "@shared/csv";
import { Readable } from "stream";
import { decryptApiKeys } from "@shared/crypto";
import { substituteVariables as sharedSubstituteVariables, storagePaths, isCellFilledForSkip } from "@shared/utils";
import { WorkingSet } from "./workingSet";
import crypto from "crypto";
import { shouldPauseOnError, buildJobErrorDetails, type CategorizedLLMError } from "@shared/llm.errors";
import type { LLMResponse } from "@shared/llm";

export class JobProcessor {
  private isRunning = false;
  private pollInterval = 3000; // 3 seconds
  private partialSaveInterval = Number(process.env.PARTIAL_SAVE_INTERVAL || 10); // Save partial every N rows

  async start() {
    this.isRunning = true;
    console.log("🔄 Job processor started, polling for new jobs...");
    this.pollForJobs();
  }

  async stop() {
    this.isRunning = false;
    console.log("⏹️ Job processor stopped");
  }

  /**
   * Main polling loop. In Phase 5 we will replace this with atomic claim logic.
   */
  private async pollForJobs() {
    while (this.isRunning) {
      try {
        await this.checkForNewJobs();
        await this.sleep(this.pollInterval);
      } catch (error) {
        console.error("❌ Error in job polling:", error);
        await this.sleep(this.pollInterval);
      }
    }
  }

  /**
   * Atomically claim a single queued job by transitioning it to `processing`.
   * Uses a transaction to avoid double-claims across multiple workers.
   */
  private async claimNextJob() {
    const leaseMs = Number(process.env.JOB_LEASE_MS || 60_000); // 60s default
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + leaseMs);
    return db.transaction(async (tx) => {
      // First preference: claim a queued job
      const queued = await tx
        .select()
        .from(enrichmentJobs)
        .where(eq(enrichmentJobs.status, "queued"))
        .limit(1);
      if (queued.length) {
        const q = queued[0];
        const updated = await tx
          .update(enrichmentJobs)
          .set({ status: "processing" as any, leaseExpiresAt: leaseUntil as any })
          .where(and(eq(enrichmentJobs.jobId, q.jobId), eq(enrichmentJobs.status, "queued")))
          .returning();
        if (updated.length) return updated[0];
      }

      // Second preference: reclaim a stuck processing job (expired lease)
      const expired = await tx
        .select()
        .from(enrichmentJobs)
        .where(
          and(
            eq(enrichmentJobs.status, "processing"),
            lt(enrichmentJobs.leaseExpiresAt, now as any),
          ),
        )
        .limit(1);
      if (expired.length) {
        const p = expired[0];
        const updated = await tx
          .update(enrichmentJobs)
          .set({ status: "processing" as any, leaseExpiresAt: leaseUntil as any })
          .where(and(eq(enrichmentJobs.jobId, p.jobId), eq(enrichmentJobs.status, "processing")))
          .returning();
        if (updated.length) return updated[0];
      }
      return null;
    });
  }

  /**
   * Fetch one job at a time via atomic claim and process it.
   */
  private async checkForNewJobs() {
    try {
      const claimed = await this.claimNextJob();
      if (claimed) {
        console.log(`📥 Claimed job ${claimed.jobId} for processing`);
        await this.processJob(claimed);
      }
    } catch (error) {
      console.error("❌ Error checking for new jobs:", error);
    }
  }

  /**
   * Core job processing pipeline. Reads user keys, downloads CSV, substitutes variables,
   * calls the shared LLM service per prompt, writes output file and updates status.
   */
  private async processJob(job: any) {
    console.log(`🚀 Starting job ${job.jobId}`);

    try {
      // Status has already been set to processing by claimNextJob()

      await this.logMessage(job.jobId, "INFO", "Job processing started");

      // Re-fetch the freshest job row to pick up current rowsProcessed and any updated status
      const freshJobRows = await db
        .select()
        .from(enrichmentJobs)
        .where(eq(enrichmentJobs.jobId, job.jobId))
        .limit(1);
      const freshJob = freshJobRows[0] || job;

      console.log(`[JobProcessor] Fresh job data:`, {
        jobId: freshJob.jobId,
        status: freshJob.status,
        rowsProcessed: freshJob.rowsProcessed,
        totalRows: freshJob.totalRows,
        hasPromptsConfig: !!freshJob.promptsConfig,
      });

      // Get user and decrypt API keys
      const user = await db.select().from(users).where(eq(users.userId, freshJob.userId)).limit(1);

      if (!user.length) {
        throw new Error("User not found");
      }

      const apiKeys = user[0].llmApiKeys
        ? decryptApiKeys(user[0].llmApiKeys as Record<string, string>)
        : {};

      if (Object.keys(apiKeys).length === 0) {
        throw new Error("No API keys configured. Please add at least one LLM provider API key.");
      }

      const llmService = new LLMService(apiKeys);

      // -------------------------------
      // Load job options from control file (default OFF)
      // -------------------------------
      const controlPath = storagePaths.controls(freshJob.userId, job.jobId);
      const readOptions = async (label: string) => {
        try {
          let buf = await supabaseService.downloadFile(controlPath);
          // Brief, one-time retry to avoid race immediately after create or resume
          if (!buf) {
            await this.sleep(250);
            buf = await supabaseService.downloadFile(controlPath);
          }
          if (!buf) {
            await this.logMessage(job.jobId, "INFO", `options_${label} default skipIfExistingValue=false (control file missing)`);
            console.log(`[Options] ${label} default skipIfExistingValue=false (missing) path=${controlPath}`);
            return { skipIfExistingValue: false } as const;
          }
          const parsed = JSON.parse(buf.toString("utf8"));
          const skip = Boolean(parsed?.skipIfExistingValue);
          await this.logMessage(job.jobId, "INFO", `options_${label} skipIfExistingValue=${skip}`);
          console.log(`[Options] ${label} skipIfExistingValue=${skip} path=${controlPath}`);
          return { skipIfExistingValue: skip } as const;
        } catch (e: any) {
          await this.logMessage(job.jobId, "WARN", `options_${label}_error ${String(e?.message || e)}`);
          console.warn(`[Options] ${label} error reading control file`, { path: controlPath, error: String(e?.message || e) });
          return { skipIfExistingValue: false } as const;
        }
      };
      let jobOptions = await readOptions("loaded");

      // -------------------------------
      // Per-job, per-prompt dedupe setup
      // -------------------------------
      const dedupeEnabled = (process.env.DQ_PROMPT_DEDUPE || "on").toLowerCase() !== "off";
      const dedupeSecret = process.env.DQ_DEDUPE_SECRET || process.env.ENCRYPTION_KEY || "dataquilt_dedupe_default";
      const userSalt = crypto.createHmac("sha256", dedupeSecret).update(String(freshJob.userId)).digest();

      // Per-prompt maps: outputColumnName -> Map<hmacKey, content> and inflight promises
      const promptResultsCache = new Map<string, Map<string, string>>();
      const promptInflight = new Map<string, Map<string, Promise<{ success: boolean; content: string; error?: string }>>>();

      // Metrics
      const totalPlannedRequests = (() => {
        const promptsCfg = (freshJob.promptsConfig as any[]) || (job.promptsConfig as any[]) || [];
        // total rows after filtering will be set later; initialize and fix after filtering
        return { promptsCount: promptsCfg.length, initialRows: 0 };
      })();
      let llmCallsMade = 0;
      let cacheHits = 0;
      let inflightHits = 0;
      // Debug helper to validate monotonic iterator position updates
      let lastCurrentRowSet = 0;

      // Get file data
      const fileRecord = await db
        .select()
        .from(files)
        .where(eq(files.fileId, freshJob.fileId))
        .limit(1);

      if (!fileRecord.length) {
        throw new Error("File not found");
      }

      // Download and parse CSV
      const fileData = await supabaseService.downloadFile(fileRecord[0].storagePath);
      if (!fileData) {
        throw new Error("Failed to download file");
      }

      let csvData = await this.parseCSV(fileData);
      if (csvData.length === 0) {
        throw new Error("CSV file is empty");
      }

      await this.logMessage(job.jobId, "INFO", `Loaded ${csvData.length} rows from file`);
      console.log(`[JobProcessor] CSV data loaded:`, {
        rowCount: csvData.length,
        sampleRow: csvData[0] || null,
        headers: csvData.length > 0 ? Object.keys(csvData[0]) : [],
      });

      // Prepare prompts and filter out rows where all input cells are empty (whitespace counts as empty)
      const prompts = (freshJob.promptsConfig as any[]) || (job.promptsConfig as any[]);
      const outputColumnNames = new Set((prompts || []).map((p: any) => p?.outputColumnName).filter(Boolean));
      const skippedIndices: number[] = [];
      const filteredRows = csvData.filter((row: Record<string, any>, index: number) => {
        // Consider only input columns (exclude any known output columns)
        const keys = Object.keys(row).filter((k) => !outputColumnNames.has(k));
        // A row is empty if all considered cells are empty/whitespace-only
        const isEmpty = keys.every((k) => {
          const v = (row as any)[k];
          if (v === null || v === undefined) return true;
          if (typeof v === "string") return v.trim().length === 0;
          // For non-strings, treat values that stringify to empty/whitespace as empty
          const s = String(v);
          return s.trim().length === 0;
        });
        if (isEmpty) {
          skippedIndices.push(index);
          return false;
        }
        return true;
      });

      // Replace working dataset with filtered rows
      csvData = filteredRows;
      // Update metric context now that we know filtered count
      totalPlannedRequests.initialRows = csvData.length;

      // Update job.totalRows to reflect non-empty rows only
      try {
        await db
          .update(enrichmentJobs)
          .set({ totalRows: csvData.length as any })
          .where(eq(enrichmentJobs.jobId, job.jobId));
      } catch (e) {
        console.warn(`[JobProcessor] Failed to update totalRows to filtered count`, e);
      }

      // Log a single summary line for skipped rows
      if (skippedIndices.length > 0) {
        await this.logMessage(
          job.jobId,
          "INFO",
          `Skipping ${skippedIndices.length} empty rows; adjusted totalRows to ${csvData.length}.`,
        );
      } else {
        await this.logMessage(job.jobId, "INFO", `No empty rows detected. totalRows=${csvData.length}`);
      }

      // Initialize WorkingSet: immutable inputs + sparse outputs overlay
      const workingSet = new WorkingSet(csvData, Array.from(outputColumnNames));

      console.log(`[JobProcessor] Prompts parsed:`, {
        promptCount: prompts.length,
        prompts: prompts.map((p: any) => ({
          model: p.model,
          outputColumn: p.outputColumnName,
          promptLength: p.promptText?.length || 0,
        })),
      });

      // Phase 5.5: Resume from the last committed progress to ensure idempotency
      let rowIndex = Number(freshJob.rowsProcessed || 0);
      if (rowIndex > 0) {
        // Try to load partial CSV file to preserve previously processed responses
        const partialPath = `enriched/${job.userId}/${job.jobId}_partial.csv`;
        const partialFileData = await supabaseService.downloadFile(partialPath);
        
        if (partialFileData) {
          try {
            const partialCsvData = await this.parseCSV(partialFileData);
            if (partialCsvData.length > 0) {
              workingSet.mergePartial(partialCsvData);
              await this.logMessage(
                job.jobId,
                "INFO",
                `Loaded partial CSV with ${partialCsvData.length} rows (preserving previous responses)`,
              );
              const stats = workingSet.getStats();
              console.log(`[JobProcessor] Loaded partial CSV with ${partialCsvData.length} rows; resume stats:`, stats);
              await this.logMessage(
                job.jobId,
                "INFO",
                `Resume stats: inputRows=${stats.inputRows} overlayRows=${stats.overlayRows} outputColumns=${stats.outputColumns.length}`,
              );
              // If DB says rowsProcessed > overlayRows (e.g., crash before partial write),
              // restart from overlayRows to ensure we don't skip unpersisted outputs.
              if (rowIndex > stats.overlayRows) {
                await this.logMessage(
                  job.jobId,
                  "WARN",
                  `rowsProcessed=${rowIndex} exceeds overlayRows=${stats.overlayRows}; restarting from ${stats.overlayRows} to avoid gaps`,
                );
                rowIndex = stats.overlayRows;
              }
            }
          } catch (error) {
            await this.logMessage(
              job.jobId,
              "WARN",
              `Failed to parse partial CSV, starting from original: ${error}`,
            );
          }
        } else {
          await this.logMessage(
            job.jobId,
            "INFO",
            `No partial CSV found, starting from original data`,
          );
          // DB indicates progress but no partial found; restart from 0 to fill early outputs.
          if (rowIndex > 0) {
            await this.logMessage(
              job.jobId,
              "WARN",
              `rowsProcessed=${rowIndex} but no partial present; restarting from 0 to ensure completeness`,
            );
            rowIndex = 0;
          }
        }
        
        await this.logMessage(
          job.jobId,
          "INFO",
          `Resuming job from row ${rowIndex + 1} (rowsProcessed=${freshJob.rowsProcessed})`,
        );
      }

      // Clamp resume index if filtering reduced the available rows
      if (rowIndex > csvData.length) {
        await this.logMessage(
          job.jobId,
          "WARN",
          `rowsProcessed (${rowIndex}) exceeds filtered totalRows (${csvData.length}). Clamping to ${csvData.length}.`,
        );
        rowIndex = csvData.length;
      }

      console.log(`[JobProcessor] WorkingSet initialized`, { totalRows: csvData.length, outputColumns: Array.from(outputColumnNames).length });
      await this.logMessage(
        job.jobId,
        "INFO",
        `Working set ready: totalRows=${csvData.length} outputColumns=${Array.from(outputColumnNames).length}`,
      );

      while (rowIndex < csvData.length) {
        // Check if job was paused or stopped
        const currentJob = await db
          .select()
          .from(enrichmentJobs)
          .where(eq(enrichmentJobs.jobId, job.jobId))
          .limit(1);

        if (!currentJob.length || currentJob[0].status === "stopped") {
          // On stop, write a final partial up to the last completed row to ensure download availability
          const alreadyDone = rowIndex; // rows 0..rowIndex-1 are completed
          if (alreadyDone > 0) {
            const partialRows = workingSet.materializeSlice(alreadyDone);
            const partialCsv = "\uFEFF" + this.convertToCSV(partialRows, workingSet.getHeaders());
            const partialPath = `enriched/${job.userId}/${job.jobId}_partial.csv`;
            await supabaseService.uploadFile(partialPath, Buffer.from(partialCsv));
            await this.logMessage(
              job.jobId,
              "INFO",
              `Stop received: wrote partial output (${alreadyDone} rows)`,
            );
          }
          // Clear currentRow on stop for cleanliness
          try {
            await db
              .update(enrichmentJobs)
              .set({ currentRow: null as any })
              .where(eq(enrichmentJobs.jobId, job.jobId));
            await this.logMessage(job.jobId, "INFO", "position_cleared reason=stop");
          } catch {}
          await this.logMessage(job.jobId, "INFO", "Job stopped by user");
          return;
        }

        if (currentJob[0].status === "paused") {
          await this.logMessage(job.jobId, "INFO", "Job paused, waiting for resume...");
          await this.waitForResume(job.jobId);
          // Reload options after resume to honor mid-run toggles
          jobOptions = await readOptions("reloaded");
          // Do not advance rowIndex; process the same row after resume
          // Also refresh lease so the job is not considered stale immediately on resume
          await db
            .update(enrichmentJobs)
            .set({
              leaseExpiresAt: new Date(
                Date.now() + Number(process.env.JOB_LEASE_MS || 60_000),
              ) as any,
            })
            .where(eq(enrichmentJobs.jobId, job.jobId));
          continue;
        }

        // Record iterator position for UI (1-based index) before processing prompts
        try {
          await db
            .update(enrichmentJobs)
            .set({
              currentRow: (rowIndex + 1) as any,
              leaseExpiresAt: new Date(
                Date.now() + Number(process.env.JOB_LEASE_MS || 60_000),
              ) as any,
            })
            .where(eq(enrichmentJobs.jobId, job.jobId));
          // Emit debug log to confirm ordering and visibility to UI
          const expected = lastCurrentRowSet + 1;
          if (expected !== rowIndex + 1) {
            await this.logMessage(
              job.jobId,
              "WARN",
              `position_set_out_of_order expected=${expected} actual=${rowIndex + 1}`,
            );
          }
          lastCurrentRowSet = rowIndex + 1;
          await this.logMessage(
            job.jobId,
            "INFO",
            `position_set currentRow=${rowIndex + 1} rowsProcessed=${rowIndex} totalRows=${csvData.length}`,
          );
        } catch (posErr) {
          console.warn(`[JobProcessor] Failed to set currentRow`, posErr);
        }

        await this.logMessage(
          job.jobId,
          "INFO",
          `Row ${rowIndex + 1}/${csvData.length}: processing`,
        );

        try {
          // Process each prompt for this row
          for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
            const prompt = prompts[promptIndex];
            const rowView = workingSet.getRowView(rowIndex);
            // Skip logic when enabled: if composed cell already has a filled value, skip generation
            if (jobOptions.skipIfExistingValue) {
              const outCol = prompt.outputColumnName;
              const existing = (rowView as any)[outCol];
              if (isCellFilledForSkip(existing)) {
                const preview = typeof existing === "string" ? existing.slice(0, 80) : String(existing).slice(0, 80);
                await this.logMessage(job.jobId, "INFO", `skip_existing row=${rowIndex + 1} col=${outCol} valuePreview=${preview}`);
                console.log(`[Skip] row=${rowIndex + 1} col=${outCol} valuePreview=${preview}`);
                continue;
              }
            }
            const processedUser = this.substituteVariables(prompt.promptText, rowView);
            const processedSystem = typeof (prompt as any).systemText === "string" && (prompt as any).systemText.length > 0
              ? this.substituteVariables((prompt as any).systemText, rowView)
              : undefined;
            // Build dedupe key (per-user, per-prompt)
            const promptId = String((prompt as any).outputColumnName || "__unnamed__");
            const provider = String(prompt.model);
            const modelId = String((prompt as any).modelId || "");
            // Compute effective options used for generation controls (no token heuristics)
            const totalLen = (processedUser?.length || 0) + (processedSystem?.length || 0);
            const timeoutMs = totalLen > 12000 ? 45000
              : totalLen > 8000 ? 30000
              : totalLen > 4000 ? 20000
              : 15000;

            const normalizedPrompt = this.normalizePrompt(processedUser);
            const normalizedSystem = processedSystem ? this.normalizePrompt(processedSystem) : undefined;
            const payload = JSON.stringify({
              promptId,
              provider,
              modelId,
              options: { temperature: 0 },
              prompt: normalizedPrompt,
              system: normalizedSystem,
            });
            const hmacKey = crypto.createHmac("sha256", userSalt).update(payload).digest("hex");
            const keySuffix = hmacKey.substring(hmacKey.length - 8);

            await this.logMessage(
              job.jobId,
              "INFO",
              `DedupeKeyComputed row=${rowIndex + 1} promptId=${promptId} model=${provider}/${modelId} keySuffix=${keySuffix} len=${normalizedPrompt.length}`,
            );
            // TEMPORARY CONSOLE: surface dedupe key computation
            console.log(`[Dedupe] key row=${rowIndex + 1} prompt=${promptId} model=${provider}/${modelId} keySuffix=${keySuffix} len=${normalizedPrompt.length}`);

            // Ensure per-prompt maps exist
            if (!promptResultsCache.has(promptId)) promptResultsCache.set(promptId, new Map());
            if (!promptInflight.has(promptId)) promptInflight.set(promptId, new Map());

            const resultsMap = promptResultsCache.get(promptId)!;
            const inflightMap = promptInflight.get(promptId)!;

            let response: LLMResponse;
            if (dedupeEnabled && resultsMap.has(hmacKey)) {
              // Cache hit
              cacheHits += 1;
              const cached = resultsMap.get(hmacKey)!;
              await this.logMessage(
                job.jobId,
                "INFO",
                `cacheHit row=${rowIndex + 1} promptId=${promptId} keySuffix=${keySuffix}`,
              );
              // TEMPORARY CONSOLE: cache hit
              console.log(`[Dedupe] cacheHit row=${rowIndex + 1} prompt=${promptId} keySuffix=${keySuffix}`);
              response = { success: true, content: cached };
            } else if (dedupeEnabled && inflightMap.has(hmacKey)) {
              // In-flight promise reuse
              inflightHits += 1;
              await this.logMessage(
                job.jobId,
                "INFO",
                `inflightHit row=${rowIndex + 1} promptId=${promptId} keySuffix=${keySuffix}`,
              );
              // TEMPORARY CONSOLE: inflight hit
              console.log(`[Dedupe] inflightHit row=${rowIndex + 1} prompt=${promptId} keySuffix=${keySuffix}`);
              try {
                response = await inflightMap.get(hmacKey)!;
              } catch (error: any) {
                // Fallback: create error response without categorizedError (will be handled as non-critical)
                response = { success: false, content: "", error: String(error?.message || error) };
              }
            } else {
              // Real LLM call path
              await this.logMessage(
                job.jobId,
                "INFO",
                `llmCallStart row=${rowIndex + 1} promptId=${promptId} model=${provider}/${modelId} keySuffix=${keySuffix} len=${normalizedPrompt.length}`,
              );
              // TEMPORARY CONSOLE: llm call start
              console.log(`[Dedupe] llmCallStart row=${rowIndex + 1} prompt=${promptId} keySuffix=${keySuffix} len=${normalizedPrompt.length}`);
              const callPromise = (async () => {
                console.log(`[JobProcessor] Making LLM call`, {
                  provider,
                  modelId,
                  promptLength: processedUser.length,
                  hasSystem: Boolean(processedSystem),
                });
                // processMessages handles errors internally and returns categorizedError
                // Don't wrap in try/catch - let it return proper error response with categorizedError
                const res = await llmService.processMessages({ systemText: processedSystem, userText: processedUser }, prompt.model, {
                  timeoutMs,
                  maxRetries: 2,
                  modelId: (prompt as any).modelId,
                });
                return res;
              })();

              if (dedupeEnabled) inflightMap.set(hmacKey, callPromise);
              llmCallsMade += 1;

              response = await callPromise;

              if (dedupeEnabled) inflightMap.delete(hmacKey);

              await this.logMessage(
                job.jobId,
                "INFO",
                `llmCallEnd row=${rowIndex + 1} promptId=${promptId} keySuffix=${keySuffix} success=${response.success} contentLen=${response.content?.length || 0}`,
              );
              // TEMPORARY CONSOLE: llm call end
              console.log(`[Dedupe] llmCallEnd row=${rowIndex + 1} prompt=${promptId} keySuffix=${keySuffix} success=${response.success} len=${response.content?.length || 0}`);

              if (dedupeEnabled && response.success && typeof response.content === "string") {
                resultsMap.set(hmacKey, response.content);
              }
            }

            if (response.success) {
              workingSet.setOutput(rowIndex, prompt.outputColumnName, response.content);
              // Safe content preview for logging (handle any edge cases)
              const contentPreview =
                typeof response.content === "string"
                  ? response.content.substring(0, 100)
                  : String(response.content || "").substring(0, 100);

              await this.logMessage(
                job.jobId,
                "INFO",
                `Row ${rowIndex + 1}: received (${prompt.model}) ${contentPreview}...`,
              );
            } else {
              // Mark cell with LLM_ERROR to indicate failure while keeping CSV shape
              workingSet.setOutput(rowIndex, prompt.outputColumnName, "LLM_ERROR");
              
              // Check if this error should trigger automatic job pause
              const categorizedError = response.categorizedError;
              console.log(`[JobProcessor] LLM call failed`, {
                rowIndex: rowIndex + 1,
                promptIndex,
                hasCategorizedError: !!categorizedError,
                category: categorizedError?.category,
                error: response.error,
              });
              if (categorizedError && shouldPauseOnError(categorizedError)) {
                // Critical error detected - attempt to pause job with error details
                try {
                  // Check current job status to avoid race conditions (e.g., already paused/stopped)
                  const currentJobCheck = await db
                    .select()
                    .from(enrichmentJobs)
                    .where(eq(enrichmentJobs.jobId, job.jobId))
                    .limit(1);

                  const currentStatus = currentJobCheck[0]?.status;
                  
                  // Allow pausing if status is "processing" or "queued" (we're actively processing it)
                  // But skip if already "paused" or "stopped" (someone else already handled it)
                  const canPause = currentStatus === "processing" || currentStatus === "queued";
                  const shouldSkip = currentStatus === "paused" || currentStatus === "stopped" || currentStatus === "completed" || currentStatus === "failed";

                  if (canPause && !shouldSkip) {
                    // Build structured error details with context
                    const errorDetails = buildJobErrorDetails(categorizedError, {
                      rowNumber: rowIndex + 1, // 1-based for user display
                      promptIndex: promptIndex, // 0-based array index
                      promptOutputColumn: prompt.outputColumnName,
                      modelId: (prompt as any).modelId,
                    });

                    // Atomic update: pause job and store error details
                    // Use WHERE clause to ensure job is still in a processable state (race condition guard)
                    // Allow pausing from both "processing" and "queued" states since we're actively processing
                    const updateResult = await db
                      .update(enrichmentJobs)
                      .set({
                        status: "paused" as any,
                        errorDetails: errorDetails as any,
                      })
                      .where(
                        and(
                          eq(enrichmentJobs.jobId, job.jobId),
                          // Allow pausing from processing or queued (handles race conditions)
                          // But prevent overwriting if already paused/stopped
                          or(
                            eq(enrichmentJobs.status, "processing" as any),
                            eq(enrichmentJobs.status, "queued" as any),
                          ),
                        ),
                      );

                    await this.logMessage(
                      job.jobId,
                      "ERROR",
                      `Row ${rowIndex + 1}, Prompt ${promptIndex + 1}: Critical error [${categorizedError.category}] - Job auto-paused. ${categorizedError.userMessage}`,
                    );
                    console.log(`[JobProcessor] Auto-paused job ${job.jobId} due to critical error`, {
                      category: categorizedError.category,
                      rowNumber: rowIndex + 1,
                      promptIndex,
                      previousStatus: currentStatus,
                    });
                    // Job is now paused - worker will detect this on next loop iteration and wait for resume
                    return; // Exit processing loop - job is paused
                  } else {
                    // Job status changed (already paused/stopped/completed) - log but don't overwrite
                    console.log(`[JobProcessor] Skipping auto-pause - job status is ${currentStatus || "unknown"}`);
                    await this.logMessage(
                      job.jobId,
                      "WARN",
                      `Row ${rowIndex + 1}: Critical error [${categorizedError.category}] detected but job already ${currentStatus || "unknown"}`,
                    );
                  }
                } catch (pauseErr: any) {
                  // Pause failed - log error but don't fail entire job
                  // Continue processing with LLM_ERROR marker (graceful degradation)
                  console.error(`[JobProcessor] Failed to auto-pause job on critical error`, {
                    jobId: job.jobId,
                    error: pauseErr?.message || String(pauseErr),
                    category: categorizedError.category,
                  });
                  await this.logMessage(
                    job.jobId,
                    "ERROR",
                    `Row ${rowIndex + 1}: Critical error [${categorizedError.category}] detected but failed to pause job: ${pauseErr?.message || String(pauseErr)}. Continuing with LLM_ERROR marker.`,
                  );
                  // Continue processing - mark cell as LLM_ERROR and proceed
                }
              } else {
                // Non-critical error or no categorized error - log and continue
                await this.logMessage(
                  job.jobId,
                  "WARN",
                  `Row ${rowIndex + 1}: ${prompt.model} failed after retries: ${response.error}`,
                );
              }
            }

            // Add jittered delay per provider to respect rate limits
            const baseDelay = this.getBaseDelayForModel(prompt.model);
            const jitter = Math.floor(Math.random() * 150); // 0-150ms jitter
            await this.sleep(baseDelay + jitter);
          }

          // Update progress and extend lease heartbeat
          await db
            .update(enrichmentJobs)
            .set({
              rowsProcessed: rowIndex + 1,
              leaseExpiresAt: new Date(
                Date.now() + Number(process.env.JOB_LEASE_MS || 60_000),
              ) as any,
            })
            .where(eq(enrichmentJobs.jobId, job.jobId));

          await this.logMessage(
            job.jobId,
            "INFO",
            `Progress updated: ${rowIndex + 1}/${csvData.length} rows completed`,
          );

          // Periodically write partial CSV for download during processing
          if ((rowIndex + 1) % this.partialSaveInterval === 0 || rowIndex === csvData.length - 1) {
            const partialRows = workingSet.materializeSlice(rowIndex + 1);
            const partialCsv = "\uFEFF" + this.convertToCSV(partialRows, workingSet.getHeaders());
            const partialPath = `enriched/${job.userId}/${job.jobId}_partial.csv`;
            try {
              await supabaseService.uploadFile(partialPath, Buffer.from(partialCsv));
              await this.logMessage(
                job.jobId,
                "INFO",
                `Row ${rowIndex + 1}: wrote partial output (${rowIndex + 1} rows)`,
              );
            } catch (partialErr: any) {
              console.warn(`[JobProcessor] Partial upload failed`, {
                jobId: job.jobId,
                row: rowIndex + 1,
                error: partialErr?.message || String(partialErr),
              });
              await this.logMessage(
                job.jobId,
                "WARN",
                `Row ${rowIndex + 1}: partial upload failed: ${partialErr?.message || String(partialErr)}`,
              );
            }
          }
        } catch (rowErr: any) {
          // Harden against unexpected row-level exceptions; do not fail entire job
          console.error(`[JobProcessor] Row ${rowIndex + 1} unexpected error`, rowErr);
          await this.logMessage(
            job.jobId,
            "ERROR",
            `Row ${rowIndex + 1}: unexpected error, marking outputs as ROW_ERROR: ${rowErr?.message || String(rowErr)}`,
          );
          try {
            // Mark all output columns for this row as ROW_ERROR (if any configured)
            for (const col of Array.from(outputColumnNames)) {
              const existing = workingSet.getRowView(rowIndex)[col];
              if (existing === undefined || existing === "") {
                workingSet.setOutput(rowIndex, col, "ROW_ERROR");
              }
            }
          } catch {}
          // Attempt progress update and partial write even on row error
          try {
            await db
              .update(enrichmentJobs)
              .set({
                rowsProcessed: rowIndex + 1,
                leaseExpiresAt: new Date(
                  Date.now() + Number(process.env.JOB_LEASE_MS || 60_000),
                ) as any,
              })
              .where(eq(enrichmentJobs.jobId, job.jobId));
            await this.logMessage(
              job.jobId,
              "INFO",
              `Progress updated after row error: ${rowIndex + 1}/${csvData.length}`,
            );
          } catch (progErr: any) {
            console.warn(`[JobProcessor] Progress update failed after row error`, progErr);
          }
          try {
            if ((rowIndex + 1) % this.partialSaveInterval === 0 || rowIndex === csvData.length - 1) {
              const partialRows = workingSet.materializeSlice(rowIndex + 1);
              const partialCsv = "\uFEFF" + this.convertToCSV(partialRows, workingSet.getHeaders());
              const partialPath = `enriched/${job.userId}/${job.jobId}_partial.csv`;
              await supabaseService.uploadFile(partialPath, Buffer.from(partialCsv));
              await this.logMessage(
                job.jobId,
                "INFO",
                `Row ${rowIndex + 1}: wrote partial output after row error`,
              );
            }
          } catch (partialErr2: any) {
            console.warn(`[JobProcessor] Partial upload failed after row error`, partialErr2);
          }
        }
        // Move to the next row only after we handled normal or error path
        rowIndex += 1;
      }

      // Save enriched CSV
      const finalRows = workingSet.materializeAll();
      const enrichedCsv = "\uFEFF" + this.convertToCSV(finalRows, workingSet.getHeaders());
      const enrichedPath = storagePaths.enriched(job.userId, job.jobId);

      await supabaseService.uploadFile(enrichedPath, Buffer.from(enrichedCsv));

      // Create and upload logs artifact as text for completed jobs
      try {
        const logsAsc = await db
          .select()
          .from(jobLogs)
          .where(eq(jobLogs.jobId, job.jobId))
          .orderBy(jobLogs.timestamp);
        const lines = logsAsc.map((l) => {
          const ts = (l as any).timestamp instanceof Date
            ? (l as any).timestamp.toISOString()
            : new Date(String((l as any).timestamp)).toISOString();
          return `[${ts}] ${(l as any).level} ${(l as any).message}`;
        });
        const txt = lines.join("\n");
        const logsPath = storagePaths.logs(job.userId, job.jobId);
        await supabaseService.uploadFile(logsPath, Buffer.from(txt, "utf8"), { contentType: "text/plain" });
        await this.logMessage(job.jobId, "INFO", `Logs artifact written: ${logsPath}`);
      } catch (logArtifactErr: any) {
        console.warn(`[JobProcessor] Failed to create/upload logs artifact`, {
          jobId: job.jobId,
          error: logArtifactErr?.message || String(logArtifactErr),
        });
      }

      // Update job as completed and finalize progress atomically to avoid UI race conditions
      // Clear errorDetails on completion (cleanup)
      await db
        .update(enrichmentJobs)
        .set({
          status: "completed",
          enrichedFilePath: enrichedPath,
          finishedAt: new Date(),
          // Ensure source-of-truth reflects full completion in the same write
          rowsProcessed: csvData.length,
          totalRows: csvData.length as any,
          currentRow: null as any,
          errorDetails: null as any, // Clear error details on successful completion
        })
        .where(eq(enrichmentJobs.jobId, job.jobId));
      // Debug log to indicate final position cleared at completion
      await this.logMessage(job.jobId, "INFO", "position_cleared reason=completed");

      await this.logMessage(
        job.jobId,
        "INFO",
        `Job completed successfully. Processed ${csvData.length} rows.`,
      );
      // Emit dedupe summary metric for UI consumption
      const planned = totalPlannedRequests.initialRows * totalPlannedRequests.promptsCount;
      const uniqueKeys = llmCallsMade;
      const avoided = cacheHits + inflightHits;
      const savingsPct = planned > 0 ? ((avoided / planned) * 100).toFixed(1) : "0.0";
      await this.logMessage(
        job.jobId,
        "INFO",
        `DEDUPE_SUMMARY total_planned=${planned} llm_calls_made=${llmCallsMade} avoided_llm_calls=${avoided} unique_keys=${uniqueKeys} savings_pct=${savingsPct}`,
      );
      // TEMPORARY CONSOLE: final summary
      console.log(`[Dedupe] SUMMARY planned=${planned} made=${llmCallsMade} avoided=${avoided} unique=${uniqueKeys} savings=${savingsPct}%`);
      console.log(`✅ Job ${job.jobId} completed successfully`);
    } catch (error: any) {
      console.error(`❌ Job ${job.jobId} failed:`, error);

      try {
        // Do not downgrade a completed job to failed if a late error occurs (e.g., logging/upload hiccup)
        const current = await db
          .select()
          .from(enrichmentJobs)
          .where(eq(enrichmentJobs.jobId, job.jobId))
          .limit(1);
        const currentStatus = current[0]?.status;

        if (currentStatus !== "completed") {
          await db
            .update(enrichmentJobs)
            .set({
              status: "failed",
              errorMessage: error.message,
              finishedAt: new Date(),
            })
            .where(eq(enrichmentJobs.jobId, job.jobId));
        } else {
          console.warn(
            `⚠️ Late error after completion ignored for job ${job.jobId}. Keeping status=completed`,
          );
        }
      } catch (updateError) {
        console.error("Failed to update job status after error:", updateError);
      }

      try {
        await this.logMessage(job.jobId, "ERROR", `Job failed: ${error.message}`);
      } catch (logErr) {
        console.error("Failed to write error log for job:", logErr);
      }
    }
  }

  private async waitForResume(jobId: string) {
    let keepWaiting = true;
    while (keepWaiting) {
      await this.sleep(5000); // Check every 5 seconds

      const job = await db
        .select()
        .from(enrichmentJobs)
        .where(eq(enrichmentJobs.jobId, jobId))
        .limit(1);

      if (!job.length || job[0].status === "stopped") {
        keepWaiting = false;
        break;
      }

      if (job[0].status === "processing") {
        await this.logMessage(jobId, "INFO", "Job resumed");
        keepWaiting = false;
        break;
      }
    }
  }

  private async parseCSV(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(createNormalizedCsvParser())
        .on("data", (data) => results.push(data))
        .on("end", () => resolve(results))
        .on("error", reject);
    });
  }

  private substituteVariables(promptText: string, rowData: any): string {
    return sharedSubstituteVariables(promptText, rowData);
  }

  /**
   * Normalize prompt text to maximize stable dedupe keys while preserving semantics.
   * - Trim leading/trailing whitespace
   * - Normalize CRLF/CR to LF
   * - Collapse runs of spaces around newlines
   */
  private normalizePrompt(input: string): string {
    if (typeof input !== "string") return String(input ?? "");
    // Convert CRLF/CR to LF
    let out = input.replace(/\r\n?/g, "\n");
    // Trim outer whitespace
    out = out.trim();
    // Optionally collapse spaces adjacent to newlines
    out = out.replace(/[ \t]*\n[ \t]*/g, "\n");
    return out;
  }

  private convertToCSV(data: any[], headers?: string[]): string {
    if (data.length === 0) return "";
    let resolvedHeaders = headers;
    if (!resolvedHeaders || resolvedHeaders.length === 0) {
      // Build headers from data if not provided
      const headerSet = new Set<string>(Object.keys(data[0]));
      for (const row of data) {
        for (const key of Object.keys(row)) headerSet.add(key);
      }
      resolvedHeaders = Array.from(headerSet);
    }
    const csvRows = [
      resolvedHeaders.join(","),
      ...data.map((row) =>
        (resolvedHeaders as string[])
          .map((header) => {
            const value = row[header] ?? "";
            // Escape quotes and wrap in quotes if contains comma/newline/quote
            const str = typeof value === "string" ? value : JSON.stringify(value);
            const escapedValue = str.replace(/"/g, '""');
            return /[",\n]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
          })
          .join(","),
      ),
    ];
    return csvRows.join("\n");
  }

  private async logMessage(jobId: string, level: "INFO" | "WARN" | "ERROR", message: string) {
    try {
      await db.insert(jobLogs).values({
        logId: uuidv4(),
        jobId,
        level,
        message,
      });
    } catch (error) {
      console.error("Failed to log message:", error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getBaseDelayForModel(model: string): number {
    // Conservative per-provider base delays (ms) to keep within common rate limits
    switch (model) {
      case "openai":
        return 400;
      case "gemini":
        return 500;
      case "perplexity":
        return 600;
      case "anthropic":
        return 500;
      default:
        return 500;
    }
  }
}

export const jobProcessor = new JobProcessor();

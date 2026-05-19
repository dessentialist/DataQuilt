import { JobsRepository } from "../repositories/jobs.repository";
import { FilesRepository } from "../repositories/files.repository";
import { logInfo } from "@shared/logger";
import { supabaseService } from "./supabase.service";
import { storagePaths } from "@shared/utils";

export const HistoryService = {
  async listHistory(params: { userId: string; input: { status?: string; limit?: number }; requestId?: string }) {
    const { userId, input, requestId } = params;
    logInfo("HistoryService.listHistory:start", { userId, requestId });

    let status: any | undefined;
    if (input.status) {
      const allowed = ["queued", "processing", "completed", "failed", "paused", "stopped"] as const;
      if (!allowed.includes(input.status as any)) {
        const err: any = new Error("Invalid status filter");
        err.code = "HISTORY_INVALID_INPUT";
        throw err;
      }
      status = input.status as any;
    }
    const limit = input.limit && Number.isFinite(input.limit) && input.limit > 0 ? input.limit : 100;

    const rows = await JobsRepository.listForUserWithOriginalName(userId, { status, limit });
    logInfo("HistoryService.listHistory:success", { userId, count: rows.length, requestId });
    return rows;
  },
  
  async deleteJob(params: { userId: string; jobId: string; requestId?: string }) {
    const { userId, jobId, requestId } = params;
    logInfo("HistoryService.deleteJob:start", { userId, jobId, requestId });

    // Load job for ownership and paths
    const jobRow = await JobsRepository.getJobForUser(jobId, userId);
    if (!jobRow) {
      const err: any = new Error("Job not found");
      err.code = "JOBS_NOT_FOUND";
      throw err;
    }

    // Load associated file row
    const fileRow = await FilesRepository.getByIdForUser(jobRow.fileId, userId);

    // Best-effort deletes of storage artifacts; do not stop DB cleanup if these fail
    if (fileRow?.storagePath) {
      await supabaseService.deleteFile(fileRow.storagePath).catch(() => {});
    }
    if (jobRow.enrichedFilePath) {
      await supabaseService.deleteFile(jobRow.enrichedFilePath).catch(() => {});
    }
    const partialPath = storagePaths.partial(userId, jobId);
    await supabaseService.deleteFile(partialPath).catch(() => {});
    // Delete logs in both new and legacy locations (best-effort)
    const logsNew = storagePaths.logs(userId, jobId);
    const logsLegacy = storagePaths.legacyLogs(userId, jobId);
    await supabaseService.deleteFile(logsNew).catch(() => {});
    await supabaseService.deleteFile(logsLegacy).catch(() => {});

    // Delete job (logs cascade) and file metadata
    await JobsRepository.deleteJob(jobId);
    if (fileRow) {
      await FilesRepository.deleteForUser(jobRow.fileId, userId);
    }

    logInfo("HistoryService.deleteJob:success", { userId, jobId, requestId });
    return { success: true } as const;
  },
};



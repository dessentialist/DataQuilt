import { logInfo, logWarn, logError } from "@shared/logger";
import { trackAudit } from "@shared/telemetry";
import { storagePaths } from "@shared/utils";
import { supabaseService } from "../services/supabase.service";
import { JobsRepository } from "../repositories/jobs.repository";
import { FilesRepository } from "../repositories/files.repository";
import { PromptTemplatesRepository } from "../repositories/templates.repository";
import { SystemTemplatesRepository } from "../repositories/system.templates.repository";
import { UsersRepository } from "../repositories/users.repository";
import { db } from "../config/database";
import { enrichmentJobs, files } from "@shared/schema";
import { eq } from "drizzle-orm";

export const AccountDeletionService = {
  /**
   * Permanently delete a user's account, data, and Supabase auth identity.
   * Order of operations minimizes race conditions and tolerates partial storage failures.
   */
  async deleteAccount(params: { userId: string; requestId?: string }) {
    const { userId, requestId } = params;
    logInfo("AccountDeletionService.start", { userId, requestId });
    trackAudit("account_delete_requested", { userId, requestId });

    // 1) Stop all active jobs for user
    const activeJobs = await JobsRepository.listActiveJobsForUser(userId);
    logInfo("AccountDeletionService.active_jobs", { userId, count: activeJobs.length, requestId });
    for (const j of activeJobs) {
      try {
        await JobsRepository.updateJobStatus(j.jobId, "stopped");
        await JobsRepository.insertLog(j.jobId, "INFO", "account_delete: job stopped prior to deletion");
      } catch (e) {
        logWarn("AccountDeletionService.stop_job_failed", { userId, requestId, jobId: j.jobId, error: String(e) });
      }
    }

    // 2) Gather all jobs for user to delete artifacts; select minimal fields to avoid heavy joins
    const jobs = await db
      .select({ jobId: enrichmentJobs.jobId, fileId: enrichmentJobs.fileId, enrichedFilePath: enrichmentJobs.enrichedFilePath })
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.userId, userId));

    let deletedJobs = 0;
    let deletedFiles = 0;
    let deletedStorageObjects = 0;
    logInfo("AccountDeletionService.jobs_found", { userId, count: jobs.length, requestId });
    for (const job of jobs) {
      try {
        // Fetch file row for original storage path
        const fileRow = await FilesRepository.getByIdForUser(job.fileId, userId);

        // Best-effort storage cleanup
        if (fileRow?.storagePath) {
          const ok = await supabaseService.deleteFile(fileRow.storagePath).catch(() => false);
          if (ok) deletedStorageObjects += 1;
        }
        if (job.enrichedFilePath) {
          const ok = await supabaseService.deleteFile(job.enrichedFilePath).catch(() => false);
          if (ok) deletedStorageObjects += 1;
        }
        const partialPath = storagePaths.partial(userId, job.jobId);
        {
          const ok = await supabaseService.deleteFile(partialPath).catch(() => false);
          if (ok) deletedStorageObjects += 1;
        }
        const logsNew = storagePaths.logs(userId, job.jobId);
        const logsLegacy = storagePaths.legacyLogs(userId, job.jobId);
        {
          const ok = await supabaseService.deleteFile(logsNew).catch(() => false);
          if (ok) deletedStorageObjects += 1;
        }
        {
          const ok = await supabaseService.deleteFile(logsLegacy).catch(() => false);
          if (ok) deletedStorageObjects += 1;
        }

        // Delete job (job_logs cascade)
        await JobsRepository.deleteJob(job.jobId);
        deletedJobs += 1;
        if (fileRow) await FilesRepository.deleteForUser(job.fileId, userId);
        if (fileRow) deletedFiles += 1;
      } catch (e) {
        logWarn("AccountDeletionService.job_cleanup_failed", { userId, requestId, jobId: job.jobId, error: String(e) });
      }
    }

    // 3) Delete templates (prompt + system)
    try {
      // Delete all user's prompt templates
      const pt = await PromptTemplatesRepository.listByUser(userId);
      logInfo("AccountDeletionService.prompt_templates_found", { userId, count: pt.length, requestId });
      for (const t of pt) {
        await PromptTemplatesRepository.deleteForUser(t.promptId, userId).catch(() => {});
      }
    } catch (e) {
      logWarn("AccountDeletionService.prompt_templates_cleanup_failed", { userId, requestId, error: String(e) });
    }
    try {
      const st = await SystemTemplatesRepository.listByUser(userId);
      logInfo("AccountDeletionService.system_templates_found", { userId, count: st.length, requestId });
      for (const t of st) {
        await SystemTemplatesRepository.deleteForUser(t.systemTemplateId, userId).catch(() => {});
      }
    } catch (e) {
      logWarn("AccountDeletionService.system_templates_cleanup_failed", { userId, requestId, error: String(e) });
    }

    // 4) Delete storage prefixes for the user (best-effort)
    try {
      const uploadsPrefix = `uploads/${userId}`;
      const enrichedPrefix = `enriched/${userId}`;
      const logsPrefix = `logs/${userId}`;
      const del1 = await supabaseService.deleteByPrefix(uploadsPrefix).catch(() => 0);
      const del2 = await supabaseService.deleteByPrefix(enrichedPrefix).catch(() => 0);
      const del3 = await supabaseService.deleteByPrefix(logsPrefix).catch(() => 0);
      deletedStorageObjects += (del1 + del2 + del3);
      logInfo("AccountDeletionService.prefix_deleted", { userId, requestId, uploads: del1, enriched: del2, logs: del3, total: del1 + del2 + del3 });
    } catch (e) {
      logWarn("AccountDeletionService.prefix_cleanup_failed", { userId, requestId, error: String(e) });
    }

    // 5) Delete user row (ensure actual deletion and verify)
    try {
      // Defense-in-depth: ensure no residue remains in dependent tables
      await db.delete(files).where(eq(files.userId, userId));
      await db.delete(enrichmentJobs).where(eq(enrichmentJobs.userId, userId));
    } catch {}
    try {
      await UsersRepository.deleteById(userId);
    } catch (e) {
      logWarn("AccountDeletionService.user_delete_failed", { userId, requestId, error: String(e) });
    }
    const userStillExists = await UsersRepository.getById(userId);
    if (userStillExists) {
      logWarn("AccountDeletionService.user_still_exists_after_delete", { userId, requestId });
    } else {
      logInfo("AccountDeletionService.user_row_deleted", { userId, requestId });
    }

    // 6) Delete Supabase auth identity (best-effort)
    const authDeleted = await supabaseService.deleteAuthUser(userId).catch(() => false);
    if (!authDeleted) {
      logWarn("AccountDeletionService.auth_delete_failed", { userId, requestId });
    }
    const authStillExists = await supabaseService.authUserExists(userId).catch(() => false);

    let userRowDeleted = !userStillExists;
    let authUserDeleted = !authStillExists;

    // Short retry if either deletion flag is false (handles propagation delays)
    if (!userRowDeleted || !authUserDeleted) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          // Small backoff between attempts
          await new Promise((r) => setTimeout(r, 300));
          logWarn("AccountDeletionService.retry_delete", { userId, requestId, attempt });

          if (!userRowDeleted) {
            try {
              await UsersRepository.deleteById(userId);
            } catch (e) {
              logWarn("AccountDeletionService.user_retry_failed", { userId, requestId, attempt, error: String(e) });
            }
          }

          if (!authUserDeleted) {
            const ok = await supabaseService.deleteAuthUser(userId).catch(() => false);
            if (!ok) {
              logWarn("AccountDeletionService.auth_retry_failed", { userId, requestId, attempt });
            }
          }

          const userExistsAgain = await UsersRepository.getById(userId);
          const authExistsAgain = await supabaseService.authUserExists(userId).catch(() => false);
          userRowDeleted = !userExistsAgain;
          authUserDeleted = !authExistsAgain;

          if (userRowDeleted && authUserDeleted) break;
        } catch (e) {
          logWarn("AccountDeletionService.retry_loop_error", { userId, requestId, attempt, error: String(e) });
        }
      }
    }
    logInfo("AccountDeletionService.success", { userId, requestId, deletedJobs, deletedFiles, deletedStorageObjects, authDeleted: authUserDeleted, userRowDeleted });
    trackAudit("account_deleted", { userId, requestId, deletedJobs, deletedFiles, deletedStorageObjects, authDeleted: authUserDeleted, userRowDeleted });
    return { success: true, userRowDeleted, authUserDeleted } as const;
  },
};



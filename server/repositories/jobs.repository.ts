import { db } from "../config/database";
import { enrichmentJobs, jobLogs, files, users } from "@shared/schema";
import { and, eq, or, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export const JobsRepository = {
  async findActiveForUser(userId: string) {
    const rows = await db
      .select()
      .from(enrichmentJobs)
      .where(
        and(
          eq(enrichmentJobs.userId, userId),
          or(eq(enrichmentJobs.status, "queued"), eq(enrichmentJobs.status, "processing"), eq(enrichmentJobs.status, "paused")),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },

  async getFileForUser(fileId: string, userId: string) {
    const rows = await db
      .select()
      .from(files)
      .where(and(eq(files.fileId, fileId), eq(files.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  },

  async createJob(data: {
    userId: string;
    fileId: string;
    promptsConfig: any;
    totalRows: number;
  }) {
    const jobId = uuidv4();
    const [row] = await db
      .insert(enrichmentJobs)
      .values({
        jobId,
        userId: data.userId,
        fileId: data.fileId,
        promptsConfig: data.promptsConfig,
        totalRows: data.totalRows,
        status: "queued",
      })
      .returning();
    return row;
  },

  async insertLog(jobId: string, level: "INFO" | "ERROR" | "WARN", message: string) {
    const [row] = await db
      .insert(jobLogs)
      .values({ logId: uuidv4(), jobId, level, message })
      .returning();
    return row;
  },

  async getJobForUser(jobId: string, userId: string) {
    const rows = await db
      .select()
      .from(enrichmentJobs)
      .where(and(eq(enrichmentJobs.jobId, jobId), eq(enrichmentJobs.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  },

  async getLogsAsc(jobId: string) {
    const rows = await db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.jobId, jobId))
      .orderBy(desc(jobLogs.timestamp));
    return rows.reverse();
  },

  async updateJobStatus(jobId: string, status: typeof enrichmentJobs.$inferSelect.status) {
    await db.update(enrichmentJobs).set({ status }).where(eq(enrichmentJobs.jobId, jobId));
  },

  /**
   * Update job status and set error details atomically
   * Used when auto-pausing a job due to a critical error
   */
  async updateJobStatusWithError(
    jobId: string,
    status: typeof enrichmentJobs.$inferSelect.status,
    errorDetails: unknown,
  ) {
    await db
      .update(enrichmentJobs)
      .set({ status, errorDetails: errorDetails as any })
      .where(eq(enrichmentJobs.jobId, jobId));
  },

  /**
   * Update job status and clear error details atomically
   * Used when resuming a job or when error is resolved
   */
  async updateJobStatusAndClearError(jobId: string, status: typeof enrichmentJobs.$inferSelect.status) {
    await db
      .update(enrichmentJobs)
      .set({ status, errorDetails: null as any })
      .where(eq(enrichmentJobs.jobId, jobId));
  },

  async getUser(userId: string) {
    const rows = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
    return rows[0] ?? null;
  },

  async listForUserWithOriginalName(userId: string, opts?: { status?: typeof enrichmentJobs.$inferSelect.status; limit?: number }) {
    const limit = opts?.limit && Number.isFinite(opts.limit) && opts.limit > 0 ? opts.limit : 100;
    const base = db
      .select({ job: enrichmentJobs, originalName: files.originalName })
      .from(enrichmentJobs)
      .innerJoin(files, eq(files.fileId, enrichmentJobs.fileId));

    const builder = opts?.status
      ? db
          .select({ job: enrichmentJobs, originalName: files.originalName })
          .from(enrichmentJobs)
          .innerJoin(files, eq(files.fileId, enrichmentJobs.fileId))
          .where(and(eq(enrichmentJobs.userId, userId), eq(enrichmentJobs.status, opts.status)))
          .orderBy(desc(enrichmentJobs.createdAt))
      : base
          .where(eq(enrichmentJobs.userId, userId))
          .orderBy(desc(enrichmentJobs.createdAt));

    const rows = await builder.limit(limit);
    return rows.map((r) => ({ ...r.job, originalName: r.originalName }));
  },
  
  async deleteJob(jobId: string) {
    await db.delete(enrichmentJobs).where(eq(enrichmentJobs.jobId, jobId));
  },

  async listActiveJobsForUser(userId: string) {
    const rows = await db
      .select()
      .from(enrichmentJobs)
      .where(
        and(
          eq(enrichmentJobs.userId, userId),
          or(
            eq(enrichmentJobs.status, "queued"),
            eq(enrichmentJobs.status, "processing"),
            eq(enrichmentJobs.status, "paused"),
          ),
        ),
      )
      .orderBy(desc(enrichmentJobs.createdAt));
    return rows;
  },

  async listRecentJobsForUser(userId: string, limit = 5) {
    const rows = await db
      .select()
      .from(enrichmentJobs)
      .where(
        and(
          eq(enrichmentJobs.userId, userId),
          or(
            eq(enrichmentJobs.status, "completed"),
            eq(enrichmentJobs.status, "failed"),
            eq(enrichmentJobs.status, "stopped"),
          ),
        ),
      )
      .orderBy(desc(enrichmentJobs.createdAt))
      .limit(limit);
    return rows;
  },

  async countQueuedJobsForUser(userId: string) {
    const rows = await db
      .select()
      .from(enrichmentJobs)
      .where(and(eq(enrichmentJobs.userId, userId), eq(enrichmentJobs.status, "queued")));
    return rows.length;
  },
};



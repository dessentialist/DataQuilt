/**
 * Test suite for JobsService.createJob queueing behavior
 *
 * Scenarios covered:
 * - Active job exists (processing/paused) → create without forceQueue throws JOBS_ACTIVE_JOB_EXISTS
 * - Active job exists → create with forceQueue succeeds with status queued
 * - Queue limit: when 2 queued jobs already exist, creating another throws JOBS_QUEUE_LIMIT_EXCEEDED
 *
 * Run: node --import tsx server/services/jobs.service.queue.test.ts
 */

import assert from "node:assert/strict";
import { JobsService } from "./jobs.service";

// Minimal mock repository implementing methods used by JobsService.createJob
class MockJobsRepository {
  private activeJob: any | null = null;
  private queuedJobs: any[] = [];
  private file: any | null = { fileId: "file-1", userId: "user-1", rowCount: 10, columnHeaders: ["col"] };

  setActiveJob(status: "processing" | "paused" | null) {
    this.activeJob = status
      ? { jobId: "active-1", userId: "user-1", status }
      : null;
  }

  setQueuedCount(n: number) {
    this.queuedJobs = Array.from({ length: n }).map((_, i) => ({
      jobId: `queued-${i + 1}`,
      userId: "user-1",
      status: "queued",
    }));
  }

  async findActiveForUser(userId: string) {
    if (this.activeJob && this.activeJob.userId === userId) return this.activeJob;
    return null;
  }

  async countQueuedJobsForUser(userId: string) {
    return this.queuedJobs.filter((j) => j.userId === userId && j.status === "queued").length;
  }

  async getFileForUser(fileId: string, userId: string) {
    if (this.file && this.file.fileId === fileId && this.file.userId === userId) {
      return this.file;
    }
    return null;
  }

  async createJob(data: { userId: string; fileId: string; promptsConfig: any; totalRows: number }) {
    const row = {
      jobId: `job-${Math.random().toString(16).slice(2)}`,
      userId: data.userId,
      fileId: data.fileId,
      promptsConfig: data.promptsConfig,
      totalRows: data.totalRows,
      status: "queued",
    };
    this.queuedJobs.push(row);
    return row;
  }

  async insertLog(_jobId: string, _level: "INFO" | "ERROR" | "WARN", _message: string) {
    return;
  }
}

// Patch JobsService to use our mock repository at runtime
function createServiceWithRepo(repo: MockJobsRepository) {
  // Monkey-patch the module's JobsRepository references
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const srv = require("./jobs.service") as typeof import("./jobs.service");
  // Override imported JobsRepository symbol
  (srv as any).JobsRepository = repo;
  return srv.JobsService;
}

async function testActiveBlocksWithoutForce() {
  console.log("Testing: Active job blocks create without forceQueue...");
  const repo = new MockJobsRepository();
  repo.setActiveJob("processing");
  repo.setQueuedCount(0);
  const Service = createServiceWithRepo(repo);

  try {
    await Service.createJob({
      userId: "user-1",
      input: {
        fileId: "file-1",
        promptsConfig: [{ promptText: "Hi", outputColumnName: "out", model: "openai", modelId: "gpt-4o-mini" }],
      },
    });
    assert.fail("Expected JOBS_ACTIVE_JOB_EXISTS");
  } catch (err: any) {
    assert.equal(err.code, "JOBS_ACTIVE_JOB_EXISTS", "should throw JOBS_ACTIVE_JOB_EXISTS");
    assert.ok(err.activeJobId, "error should include activeJobId");
  }
  console.log("✅ Active blocks without forceQueue");
}

async function testPausedCountsAsActive() {
  console.log("Testing: Paused counts as active...");
  const repo = new MockJobsRepository();
  repo.setActiveJob("paused");
  repo.setQueuedCount(0);
  const Service = createServiceWithRepo(repo);

  try {
    await Service.createJob({
      userId: "user-1",
      input: {
        fileId: "file-1",
        promptsConfig: [{ promptText: "Hi", outputColumnName: "out", model: "openai", modelId: "gpt-4o-mini" }],
      },
    });
    assert.fail("Expected JOBS_ACTIVE_JOB_EXISTS for paused");
  } catch (err: any) {
    assert.equal(err.code, "JOBS_ACTIVE_JOB_EXISTS", "paused should be treated as active");
  }
  console.log("✅ Paused treated as active");
}

async function testForceQueueAllowsWhenActive() {
  console.log("Testing: forceQueue allows queueing when active...");
  const repo = new MockJobsRepository();
  repo.setActiveJob("processing");
  repo.setQueuedCount(0);
  const Service = createServiceWithRepo(repo);

  const res = await Service.createJob({
    userId: "user-1",
    input: {
      fileId: "file-1",
      promptsConfig: [{ promptText: "Hi", outputColumnName: "out", model: "openai", modelId: "gpt-4o-mini" }],
      forceQueue: true,
    },
  });
  assert.ok(res.jobId, "queued job should have jobId");
  console.log("✅ forceQueue queued job successfully");
}

async function testQueueLimit() {
  console.log("Testing: queue limit (2) enforced...");
  const repo = new MockJobsRepository();
  repo.setActiveJob(null);
  repo.setQueuedCount(2);
  const Service = createServiceWithRepo(repo);

  try {
    await Service.createJob({
      userId: "user-1",
      input: {
        fileId: "file-1",
        promptsConfig: [{ promptText: "Hi", outputColumnName: "out", model: "openai", modelId: "gpt-4o-mini" }],
        forceQueue: true,
      },
    });
    assert.fail("Expected JOBS_QUEUE_LIMIT_EXCEEDED");
  } catch (err: any) {
    assert.equal(err.code, "JOBS_QUEUE_LIMIT_EXCEEDED", "should enforce queue limit");
  }
  console.log("✅ Queue limit enforced");
}

async function run() {
  try {
    await testActiveBlocksWithoutForce();
    await testPausedCountsAsActive();
    await testForceQueueAllowsWhenActive();
    await testQueueLimit();
    console.log("\n✅ All queueing tests passed!");
  } catch (err: any) {
    console.error("\n❌ Queueing test failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();





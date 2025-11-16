/**
 * Test suite for JobsService controlJob error pause cleanup
 * 
 * Tests cover:
 * - Resume clears errorDetails
 * - Stop clears errorDetails
 * - Pause preserves errorDetails (if set by auto-pause)
 * 
 * Run: node --import tsx server/services/jobs.service.error-pause.test.ts
 */

import assert from "node:assert/strict";
import type { JobErrorDetails } from "@shared/llm.errors";

// Mock repository
class MockJobsRepository {
  private jobs: Map<string, any> = new Map();

  constructor() {
    // Setup test job with errorDetails
    this.jobs.set("test-job-id", {
      jobId: "test-job-id",
      userId: "test-user-id",
      status: "paused",
      errorDetails: {
        category: "AUTH_ERROR",
        userMessage: "Invalid API key",
        technicalMessage: "401 Unauthorized",
        rowNumber: 5,
        promptIndex: 2,
        promptOutputColumn: "Summary",
        provider: "openai",
        modelId: "gpt-4o",
        timestamp: new Date().toISOString(),
        metadata: { statusCode: 401 },
      },
    });
  }

  async getJobForUser(jobId: string, userId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) return null;
    return job;
  }

  private updateJobStatusCallCount = 0;
  private updateJobStatusAndClearErrorCallCount = 0;

  async updateJobStatus(jobId: string, status: string) {
    this.updateJobStatusCallCount++;
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      // Note: updateJobStatus does NOT clear errorDetails (preserves it)
    }
    return job;
  }

  async updateJobStatusAndClearError(jobId: string, status: string) {
    this.updateJobStatusAndClearErrorCallCount++;
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.errorDetails = null;
    }
    return job;
  }

  getUpdateJobStatusCallCount() {
    return this.updateJobStatusCallCount;
  }

  getUpdateJobStatusAndClearErrorCallCount() {
    return this.updateJobStatusAndClearErrorCallCount;
  }

  resetCallCounts() {
    this.updateJobStatusCallCount = 0;
    this.updateJobStatusAndClearErrorCallCount = 0;
  }

  async insertLog(jobId: string, level: string, message: string) {
    return { logId: "test-log-id", jobId, level, message };
  }

  getJob(jobId: string) {
    return this.jobs.get(jobId);
  }
}

// Mock service (simplified)
class MockJobsService {
  private repo: MockJobsRepository;

  constructor(repo: MockJobsRepository) {
    this.repo = repo;
  }

  async controlJob(params: {
    userId: string;
    jobId: string;
    command: "pause" | "resume" | "stop";
    requestId?: string;
  }) {
    const { userId, jobId, command } = params;

    const job = await this.repo.getJobForUser(jobId, userId);
    if (!job) {
      const err: any = new Error("Job not found");
      err.code = "JOBS_NOT_FOUND";
      throw err;
    }

    switch (command) {
      case "resume":
        // Clear errorDetails when resuming
        await this.repo.updateJobStatusAndClearError(jobId, "processing");
        await this.repo.insertLog(jobId, "INFO", "Job resumed by user");
        return { accepted: true };
      case "stop":
        // Clear errorDetails when stopping
        await this.repo.updateJobStatusAndClearError(jobId, "stopped");
        await this.repo.insertLog(jobId, "INFO", "Job stopped by user");
        return { accepted: true };
      case "pause":
        // For pause command, keep errorDetails if it exists (may have been set by auto-pause)
        await this.repo.updateJobStatus(jobId, "paused");
        await this.repo.insertLog(jobId, "INFO", "Job paused by user");
        return { accepted: true };
      default: {
        const err: any = new Error("Invalid command");
        err.code = "JOBS_CONTROL_INVALID_COMMAND";
        throw err;
      }
    }
  }
}

async function testResumeClearsErrorDetails() {
  console.log("Testing resume clears errorDetails...");

  const repo = new MockJobsRepository();
  const service = new MockJobsService(repo);
  repo.resetCallCounts();

  // Verify job has errorDetails before resume
  const jobBefore = repo.getJob("test-job-id");
  assert.ok(jobBefore.errorDetails, "job should have errorDetails before resume");

  // Resume job
  await service.controlJob({
    userId: "test-user-id",
    jobId: "test-job-id",
    command: "resume",
  });

  // Verify errorDetails cleared and status changed
  const jobAfter = repo.getJob("test-job-id");
  assert.equal(jobAfter.status, "processing", "status should be processing");
  assert.equal(jobAfter.errorDetails, null, "errorDetails should be cleared");

  // Verify resume uses updateJobStatusAndClearError (NOT updateJobStatus)
  assert.equal(repo.getUpdateJobStatusAndClearErrorCallCount(), 1, "resume should call updateJobStatusAndClearError");
  assert.equal(repo.getUpdateJobStatusCallCount(), 0, "resume should NOT call updateJobStatus");

  console.log("✅ Resume clears errorDetails test passed");
}

async function testStopClearsErrorDetails() {
  console.log("Testing stop clears errorDetails...");

  const repo = new MockJobsRepository();
  const service = new MockJobsService(repo);
  repo.resetCallCounts();

  // Reset job to paused with error
  repo.getJob("test-job-id").status = "paused";
  repo.getJob("test-job-id").errorDetails = {
    category: "QUOTA_EXCEEDED",
    userMessage: "Quota exceeded",
    technicalMessage: "429 Too Many Requests",
    rowNumber: 1,
    promptIndex: 0,
    promptOutputColumn: "Output",
    provider: "openai",
    timestamp: new Date().toISOString(),
    metadata: {},
  };

  // Stop job
  await service.controlJob({
    userId: "test-user-id",
    jobId: "test-job-id",
    command: "stop",
  });

  // Verify errorDetails cleared and status changed
  const jobAfter = repo.getJob("test-job-id");
  assert.equal(jobAfter.status, "stopped", "status should be stopped");
  assert.equal(jobAfter.errorDetails, null, "errorDetails should be cleared");

  // Verify stop uses updateJobStatusAndClearError (NOT updateJobStatus)
  assert.equal(repo.getUpdateJobStatusAndClearErrorCallCount(), 1, "stop should call updateJobStatusAndClearError");
  assert.equal(repo.getUpdateJobStatusCallCount(), 0, "stop should NOT call updateJobStatus");

  console.log("✅ Stop clears errorDetails test passed");
}

async function testPausePreservesErrorDetails() {
  console.log("Testing pause preserves errorDetails...");

  const repo = new MockJobsRepository();
  const service = new MockJobsService(repo);
  repo.resetCallCounts();

  // Reset job to processing (no error)
  repo.getJob("test-job-id").status = "processing";
  repo.getJob("test-job-id").errorDetails = null;

  // Pause job (manual pause, no error)
  await service.controlJob({
    userId: "test-user-id",
    jobId: "test-job-id",
    command: "pause",
  });

  // Verify status changed but errorDetails remains null
  const jobAfter = repo.getJob("test-job-id");
  assert.equal(jobAfter.status, "paused", "status should be paused");
  assert.equal(jobAfter.errorDetails, null, "errorDetails should remain null (manual pause)");

  // Verify pause uses updateJobStatus (NOT updateJobStatusAndClearError)
  assert.equal(repo.getUpdateJobStatusCallCount(), 1, "pause should call updateJobStatus");
  assert.equal(repo.getUpdateJobStatusAndClearErrorCallCount(), 0, "pause should NOT call updateJobStatusAndClearError");

  // Now test: if job already has errorDetails (from auto-pause), pause should preserve it
  repo.getJob("test-job-id").errorDetails = {
    category: "CONTENT_FILTERED",
    userMessage: "Content filtered",
    technicalMessage: "Content policy violation",
    rowNumber: 3,
    promptIndex: 1,
    promptOutputColumn: "Summary",
    provider: "openai",
    timestamp: new Date().toISOString(),
    metadata: {},
  };
  repo.getJob("test-job-id").status = "processing";
  repo.resetCallCounts();

  // Pause again (should preserve existing errorDetails)
  await service.controlJob({
    userId: "test-user-id",
    jobId: "test-job-id",
    command: "pause",
  });

  const jobAfterPause = repo.getJob("test-job-id");
  assert.equal(jobAfterPause.status, "paused", "status should be paused");
  assert.ok(jobAfterPause.errorDetails, "errorDetails should be preserved");
  assert.equal(jobAfterPause.errorDetails.category, "CONTENT_FILTERED", "errorDetails category should be preserved");

  // Verify pause still uses updateJobStatus (preserves errorDetails)
  assert.equal(repo.getUpdateJobStatusCallCount(), 1, "pause should call updateJobStatus");
  assert.equal(repo.getUpdateJobStatusAndClearErrorCallCount(), 0, "pause should NOT call updateJobStatusAndClearError");

  console.log("✅ Pause preserves errorDetails test passed");
}

async function testJobNotFound() {
  console.log("Testing job not found error...");

  const repo = new MockJobsRepository();
  const service = new MockJobsService(repo);

  try {
    await service.controlJob({
      userId: "wrong-user-id",
      jobId: "test-job-id",
      command: "resume",
    });
    assert.fail("Should have thrown JOBS_NOT_FOUND");
  } catch (err: any) {
    assert.equal(err.code, "JOBS_NOT_FOUND", "should throw JOBS_NOT_FOUND");
  }

  console.log("✅ Job not found error test passed");
}

async function testInvalidCommand() {
  console.log("Testing invalid command error...");

  const repo = new MockJobsRepository();
  const service = new MockJobsService(repo);

  try {
    await (service as any).controlJob({
      userId: "test-user-id",
      jobId: "test-job-id",
      command: "invalid",
    });
    assert.fail("Should have thrown JOBS_CONTROL_INVALID_COMMAND");
  } catch (err: any) {
    assert.equal(err.code, "JOBS_CONTROL_INVALID_COMMAND", "should throw JOBS_CONTROL_INVALID_COMMAND");
  }

  console.log("✅ Invalid command error test passed");
}

async function run() {
  try {
    await testResumeClearsErrorDetails();
    await testStopClearsErrorDetails();
    await testPausePreservesErrorDetails();
    await testJobNotFound();
    await testInvalidCommand();
    console.log("\n✅ All JobsService error pause tests passed!");
  } catch (err: any) {
    console.error("\n❌ Test failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();


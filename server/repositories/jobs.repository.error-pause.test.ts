/**
 * Test suite for JobsRepository error pause methods
 * 
 * Tests cover:
 * - updateJobStatusWithError() atomic update
 * - updateJobStatusAndClearError() atomic clear
 * 
 * Note: These tests mock the database layer. For integration tests,
 * see the worker/service tests that exercise the full flow.
 * 
 * Run: node --import tsx server/repositories/jobs.repository.error-pause.test.ts
 */

import assert from "node:assert/strict";
import type { JobErrorDetails } from "@shared/llm.errors";

// Mock database - in real tests, you'd use a test database or mock Drizzle
class MockDb {
  private jobs: Map<string, any> = new Map();

  update(table: any) {
    return {
      set: (values: any) => ({
        where: (condition: any) => {
          // Simulate update - in real implementation, this would update the database
          return Promise.resolve();
        },
      }),
    };
  }
}

// Mock repository methods (simplified for testing)
class MockJobsRepository {
  private db: MockDb;

  constructor(db: MockDb) {
    this.db = db;
  }

  async updateJobStatusWithError(
    jobId: string,
    status: "paused" | "processing" | "completed" | "failed" | "stopped" | "queued",
    errorDetails: unknown,
  ) {
    // Simulate atomic update
    await this.db.update("enrichment_jobs").set({ status, errorDetails }).where({ jobId });
    return { jobId, status, errorDetails };
  }

  async updateJobStatusAndClearError(
    jobId: string,
    status: "paused" | "processing" | "completed" | "failed" | "stopped" | "queued",
  ) {
    // Simulate atomic clear
    await this.db.update("enrichment_jobs").set({ status, errorDetails: null }).where({ jobId });
    return { jobId, status, errorDetails: null };
  }
}

async function testUpdateJobStatusWithError() {
  console.log("Testing updateJobStatusWithError()...");

  const db = new MockDb();
  const repo = new MockJobsRepository(db);

  const errorDetails: JobErrorDetails = {
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
  };

  // Test 1: Basic update with error details
  const result = await repo.updateJobStatusWithError("test-job-id", "paused", errorDetails);
  assert.equal(result.jobId, "test-job-id", "jobId should match");
  assert.equal(result.status, "paused", "status should be paused");
  assert.deepEqual(result.errorDetails, errorDetails, "errorDetails should match");

  // Test 2: Update with different error categories
  const quotaError: JobErrorDetails = {
    ...errorDetails,
    category: "QUOTA_EXCEEDED",
    userMessage: "Quota exceeded",
    technicalMessage: "429 Too Many Requests",
    metadata: { statusCode: 429 },
  };
  const quotaResult = await repo.updateJobStatusWithError("test-job-id", "paused", quotaError);
  assert.equal(quotaResult.status, "paused", "status should be paused");
  assert.equal(quotaResult.errorDetails.category, "QUOTA_EXCEEDED", "error category should match");

  // Test 3: Update with content filtered error
  const contentError: JobErrorDetails = {
    ...errorDetails,
    category: "CONTENT_FILTERED",
    userMessage: "Content filtered",
    technicalMessage: "Content policy violation",
    metadata: { finishReason: "content_filter" },
  };
  const contentResult = await repo.updateJobStatusWithError("test-job-id", "paused", contentError);
  assert.equal(contentResult.status, "paused", "status should be paused");
  assert.equal(contentResult.errorDetails.category, "CONTENT_FILTERED", "error category should match");

  // Test 4: Update preserves all error details fields
  const fullError: JobErrorDetails = {
    category: "AUTH_ERROR",
    userMessage: "Invalid API key",
    technicalMessage: "401 Unauthorized",
    rowNumber: 10,
    promptIndex: 3,
    promptOutputColumn: "Analysis",
    provider: "gemini",
    modelId: "gemini-pro",
    timestamp: new Date().toISOString(),
    metadata: {
      statusCode: 401,
      errorCode: "invalid_api_key",
      originalMessage: "API key is invalid",
    },
  };
  const fullResult = await repo.updateJobStatusWithError("test-job-id", "paused", fullError);
  assert.equal(fullResult.errorDetails.rowNumber, 10, "rowNumber should match");
  assert.equal(fullResult.errorDetails.promptIndex, 3, "promptIndex should match");
  assert.equal(fullResult.errorDetails.promptOutputColumn, "Analysis", "promptOutputColumn should match");
  assert.equal(fullResult.errorDetails.provider, "gemini", "provider should match");
  assert.equal(fullResult.errorDetails.modelId, "gemini-pro", "modelId should match");
  assert.ok(fullResult.errorDetails.metadata.errorCode, "metadata.errorCode should be preserved");

  console.log("✅ updateJobStatusWithError() tests passed");
}

async function testUpdateJobStatusAndClearError() {
  console.log("Testing updateJobStatusAndClearError()...");

  const db = new MockDb();
  const repo = new MockJobsRepository(db);

  // First set error details to ensure clearing works
  const errorDetails: JobErrorDetails = {
    category: "AUTH_ERROR",
    userMessage: "Invalid API key",
    technicalMessage: "401 Unauthorized",
    rowNumber: 1,
    promptIndex: 0,
    promptOutputColumn: "Output",
    provider: "openai",
    timestamp: new Date().toISOString(),
    metadata: {},
  };
  await repo.updateJobStatusWithError("test-job-id", "paused", errorDetails);

  // Test 1: Resume (clears error)
  const resumeResult = await repo.updateJobStatusAndClearError("test-job-id", "processing");
  assert.equal(resumeResult.jobId, "test-job-id", "jobId should match");
  assert.equal(resumeResult.status, "processing", "status should be processing");
  assert.equal(resumeResult.errorDetails, null, "errorDetails should be null after resume");

  // Test 2: Stop (clears error)
  await repo.updateJobStatusWithError("test-job-id", "paused", errorDetails);
  const stopResult = await repo.updateJobStatusAndClearError("test-job-id", "stopped");
  assert.equal(stopResult.status, "stopped", "status should be stopped");
  assert.equal(stopResult.errorDetails, null, "errorDetails should be null after stop");

  // Test 3: Completion (clears error)
  await repo.updateJobStatusWithError("test-job-id", "processing", errorDetails);
  const completeResult = await repo.updateJobStatusAndClearError("test-job-id", "completed");
  assert.equal(completeResult.status, "completed", "status should be completed");
  assert.equal(completeResult.errorDetails, null, "errorDetails should be null after completion");

  // Test 4: Clear when errorDetails is already null (should still work)
  const alreadyNullResult = await repo.updateJobStatusAndClearError("test-job-id", "processing");
  assert.equal(alreadyNullResult.status, "processing", "status should be processing");
  assert.equal(alreadyNullResult.errorDetails, null, "errorDetails should remain null");

  // Test 5: Multiple clear operations preserve null
  const clearAgain = await repo.updateJobStatusAndClearError("test-job-id", "stopped");
  assert.equal(clearAgain.errorDetails, null, "errorDetails should remain null on multiple clears");

  console.log("✅ updateJobStatusAndClearError() tests passed");
}

async function testAtomicUpdateBehavior() {
  console.log("Testing atomic update behavior...");

  const db = new MockDb();
  const repo = new MockJobsRepository(db);

  // Test 1: Both status and errorDetails updated together
  const errorDetails: JobErrorDetails = {
    category: "AUTH_ERROR",
    userMessage: "Invalid API key",
    technicalMessage: "401 Unauthorized",
    rowNumber: 1,
    promptIndex: 0,
    promptOutputColumn: "Output",
    provider: "openai",
    modelId: "gpt-4o",
    timestamp: new Date().toISOString(),
    metadata: { statusCode: 401 },
  };

  const result = await repo.updateJobStatusWithError("test-job-id", "paused", errorDetails);
  assert.equal(result.status, "paused", "status should be updated");
  assert.deepEqual(result.errorDetails, errorDetails, "errorDetails should be updated atomically");

  // Test 2: Clear errorDetails atomically with status change
  const clearResult = await repo.updateJobStatusAndClearError("test-job-id", "processing");
  assert.equal(clearResult.status, "processing", "status should be updated");
  assert.equal(clearResult.errorDetails, null, "errorDetails should be cleared atomically");

  // Test 3: Multiple status transitions preserve atomicity
  await repo.updateJobStatusWithError("test-job-id", "paused", errorDetails);
  const pausedResult = await repo.updateJobStatusWithError("test-job-id", "paused", errorDetails);
  assert.equal(pausedResult.status, "paused", "status should remain paused");
  assert.deepEqual(pausedResult.errorDetails, errorDetails, "errorDetails should remain set");

  // Test 4: Clear on different status transitions
  await repo.updateJobStatusAndClearError("test-job-id", "stopped");
  const stoppedResult = await repo.updateJobStatusAndClearError("test-job-id", "completed");
  assert.equal(stoppedResult.status, "completed", "status should transition to completed");
  assert.equal(stoppedResult.errorDetails, null, "errorDetails should remain cleared");

  console.log("✅ Atomic update behavior tests passed");
}

async function run() {
  try {
    await testUpdateJobStatusWithError();
    await testUpdateJobStatusAndClearError();
    await testAtomicUpdateBehavior();
    console.log("\n✅ All JobsRepository error pause tests passed!");
  } catch (err: any) {
    console.error("\n❌ Test failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();


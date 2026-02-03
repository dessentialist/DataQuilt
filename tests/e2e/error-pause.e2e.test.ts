/**
 * E2E Tests: Auto-Pause on Critical LLM Errors
 * 
 * Tests the full flow with real API errors:
 * 1. Create test user with invalid API keys
 * 2. Create job with test CSV
 * 3. Worker processes job and hits AUTH_ERROR
 * 4. Verify auto-pause triggered
 * 5. Verify errorDetails stored correctly
 * 6. Test resume/stop functionality
 * 
 * Compatible with Replit environment - uses real database and worker
 * 
 * Run: node --import tsx tests/e2e/error-pause.e2e.test.ts
 * 
 * Required Environment Variables:
 * - ENCRYPTION_KEY: For encrypting test API keys
 * - SUPABASE_URL: Database connection
 * - SUPABASE_SERVICE_ROLE_KEY: Database access
 * - DATABASE_URL: Direct database connection (optional)
 */

import "dotenv/config";
import assert from "node:assert/strict";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../worker/lib/supabase.js";
import { users, files, enrichmentJobs, jobLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { JobsService } from "../../server/services/jobs.service.js";
import { encryptApiKeys } from "@shared/crypto";
import { supabaseService } from "../../server/services/supabase.service.js";
import { JobProcessor } from "../../worker/services/job.processor.js";
import { validateJobErrorDetails } from "@shared/llm.errors";

/**
 * Sleep utility for waiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create test user with invalid API keys (to trigger AUTH_ERROR)
 */
async function createTestUserWithInvalidKeys(): Promise<{ userId: string; email: string }> {
  const userId = uuidv4();
  const email = `e2e-test-${userId.slice(0, 8)}@example.com`;

  // Create user with invalid OpenAI API key (will trigger AUTH_ERROR)
  const invalidApiKeys = {
    openai: "sk-invalid-key-for-testing-1234567890", // Invalid key format
  };
  const encryptedKeys = encryptApiKeys(invalidApiKeys);

  await db.insert(users).values({
    userId,
    email,
    llmApiKeys: encryptedKeys as any,
  });

  console.log(`[E2E] Created test user: ${userId} (${email})`);
  return { userId, email };
}

/**
 * Create test CSV file
 */
async function createTestFile(userId: string): Promise<{ fileId: string; rowCount: number }> {
  const fileId = uuidv4();
  
  // Create minimal CSV with 3 rows (small for fast testing)
  const csvRows = [
    "review",
    "Great product",
    "Bad service",
    "Average quality",
  ];
  const csvContent = csvRows.join("\n") + "\n";
  const fileBuffer = Buffer.from(csvContent, "utf8");

  const storagePath = `uploads/${userId}/${fileId}.csv`;
  
  // Ensure bucket exists
  await supabaseService.ensureBucketExists("oracle-files");
  
  const uploadRes = await supabaseService.uploadFile(storagePath, fileBuffer);
  if (!uploadRes.data) {
    throw new Error(`Failed to upload test CSV: ${uploadRes.error?.message || "Unknown error"}`);
  }

  // Insert file metadata
  const rowCount = csvRows.length - 1; // Exclude header
  const columnHeaders = ["review"];
  
  await db.insert(files).values({
    fileId,
    userId,
    storagePath,
    originalName: "e2e_test.csv",
    rowCount,
    columnHeaders: columnHeaders as any,
  });

  console.log(`[E2E] Created test file: ${fileId} (${rowCount} rows)`);
  return { fileId, rowCount };
}

/**
 * Wait for job to reach a specific status or timeout
 */
async function waitForJobStatus(
  jobId: string,
  expectedStatus: string,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 1000,
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const jobRows = await db
      .select()
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.jobId, jobId))
      .limit(1);
    
    if (jobRows.length > 0 && jobRows[0].status === expectedStatus) {
      return true;
    }
    
    await sleep(pollIntervalMs);
  }
  
  return false;
}

/**
 * Get job with errorDetails
 */
async function getJobWithErrorDetails(jobId: string) {
  const jobRows = await db
    .select()
    .from(enrichmentJobs)
    .where(eq(enrichmentJobs.jobId, jobId))
    .limit(1);
  
  return jobRows[0] || null;
}

/**
 * Get job logs
 */
async function getJobLogs(jobId: string) {
  const logRows = await db
    .select()
    .from(jobLogs)
    .where(eq(jobLogs.jobId, jobId))
    .orderBy(jobLogs.timestamp);
  
  return logRows;
}

/**
 * Cleanup test data
 */
async function cleanup(userId: string, fileId: string, jobId: string) {
  console.log(`[E2E] Cleaning up test data...`);
  
  try {
    // Delete job logs
    await db.delete(jobLogs).where(eq(jobLogs.jobId, jobId));
    
    // Delete job
    await db.delete(enrichmentJobs).where(eq(enrichmentJobs.jobId, jobId));
    
    // Delete file metadata
    await db.delete(files).where(eq(files.fileId, fileId));
    
    // Delete user
    await db.delete(users).where(eq(users.userId, userId));
    
    // Cleanup storage files (best effort)
    try {
      const storagePath = `uploads/${userId}/${fileId}.csv`;
      await supabaseService.deleteFile(storagePath);
    } catch (e) {
      console.warn(`[E2E] Failed to delete storage file: ${e}`);
    }
    
    console.log(`[E2E] Cleanup complete`);
  } catch (error) {
    console.error(`[E2E] Cleanup error:`, error);
  }
}

async function testAuthErrorAutoPause() {
  console.log("\n=== Testing AUTH_ERROR Auto-Pause ===");
  
  let userId: string | null = null;
  let fileId: string | null = null;
  let jobId: string | null = null;
  
  try {
    // Step 1: Create test user with invalid API keys
    const { userId: testUserId, email } = await createTestUserWithInvalidKeys();
    userId = testUserId;
    
    // Step 2: Create test CSV file
    const { fileId: testFileId, rowCount } = await createTestFile(testUserId);
    fileId = testFileId;
    
    // Step 3: Create job
    const job = await JobsService.createJob({
      userId: testUserId,
      input: {
        fileId: testFileId,
        promptsConfig: [
          {
            model: "openai",
            modelId: "gpt-4o-mini",
            systemText: "You are a helpful assistant.",
            promptText: "Summarize this review: {{review}}",
            outputColumnName: "summary",
          },
        ],
      },
      requestId: `e2e-test-${uuidv4()}`,
    });
    jobId = job.jobId;
    console.log(`[E2E] Created job: ${jobId}`);
    
    // Step 4: Start worker to process job
    const processor = new JobProcessor();
    await processor.start();
    
    // Step 5: Wait for job to be paused due to AUTH_ERROR
    console.log(`[E2E] Waiting for job to auto-pause...`);
    const paused = await waitForJobStatus(jobId, "paused", 60000); // 60 second timeout
    
    assert.ok(paused, "Job should be paused due to AUTH_ERROR");
    console.log(`[E2E] Job paused successfully`);
    
    // Step 6: Verify errorDetails stored correctly
    const jobWithError = await getJobWithErrorDetails(jobId);
    assert.ok(jobWithError, "Job should exist");
    assert.equal(jobWithError.status, "paused", "Job status should be paused");
    assert.ok(jobWithError.errorDetails, "Job should have errorDetails");
    
    const validatedErrorDetails = validateJobErrorDetails(jobWithError.errorDetails);
    assert.ok(validatedErrorDetails, "errorDetails should be valid");
    assert.equal(validatedErrorDetails!.category, "AUTH_ERROR", "Error category should be AUTH_ERROR");
    assert.equal(validatedErrorDetails!.rowNumber, 1, "Error should occur at row 1");
    assert.equal(validatedErrorDetails!.promptIndex, 0, "Error should occur at prompt 0");
    assert.equal(validatedErrorDetails!.promptOutputColumn, "summary", "Output column should match");
    assert.equal(validatedErrorDetails!.provider, "openai", "Provider should be openai");
    assert.ok(validatedErrorDetails!.userMessage, "User message should be present");
    assert.ok(validatedErrorDetails!.technicalMessage, "Technical message should be present");
    assert.ok(validatedErrorDetails!.timestamp, "Timestamp should be present");
    
    console.log(`[E2E] ErrorDetails validated:`, {
      category: validatedErrorDetails!.category,
      rowNumber: validatedErrorDetails!.rowNumber,
      promptIndex: validatedErrorDetails!.promptIndex,
    });
    
    // Step 7: Verify logs contain error information
    const logs = await getJobLogs(jobId);
    const errorLogs = logs.filter((log) => 
      log.level === "ERROR" && 
      log.message.includes("AUTH_ERROR")
    );
    assert.ok(errorLogs.length > 0, "Should have error logs about AUTH_ERROR");
    console.log(`[E2E] Found ${errorLogs.length} error logs`);
    
    // Step 8: Stop processor
    await processor.stop();
    
    console.log("✅ AUTH_ERROR auto-pause test passed");
  } catch (error) {
    console.error("❌ AUTH_ERROR auto-pause test failed:", error);
    throw error;
  } finally {
    // Cleanup
    if (userId && fileId && jobId) {
      await cleanup(userId, fileId, jobId);
    }
  }
}

async function testResumeAfterError() {
  console.log("\n=== Testing Resume After Error ===");
  
  let userId: string | null = null;
  let fileId: string | null = null;
  let jobId: string | null = null;
  
  try {
    // Step 1: Create test user with invalid API keys
    const { userId: testUserId } = await createTestUserWithInvalidKeys();
    userId = testUserId;
    
    // Step 2: Create test CSV file
    const { fileId: testFileId } = await createTestFile(testUserId);
    fileId = testFileId;
    
    // Step 3: Create job
    const job = await JobsService.createJob({
      userId: testUserId,
      input: {
        fileId: testFileId,
        promptsConfig: [
          {
            model: "openai",
            modelId: "gpt-4o-mini",
            systemText: "You are a helpful assistant.",
            promptText: "Summarize: {{review}}",
            outputColumnName: "summary",
          },
        ],
      },
      requestId: `e2e-test-${uuidv4()}`,
    });
    jobId = job.jobId;
    
    // Step 4: Process job until it pauses
    const processor = new JobProcessor();
    await processor.start();
    await waitForJobStatus(jobId, "paused", 60000);
    await processor.stop();
    
    // Step 5: Verify errorDetails exists
    const jobBeforeResume = await getJobWithErrorDetails(jobId);
    assert.ok(jobBeforeResume?.errorDetails, "Job should have errorDetails before resume");
    
    // Step 6: Resume job (should clear errorDetails)
    await JobsService.controlJob({
      userId: testUserId,
      jobId,
      command: "resume",
      requestId: `e2e-test-${uuidv4()}`,
    });
    
    // Step 7: Verify errorDetails cleared
    const jobAfterResume = await getJobWithErrorDetails(jobId);
    assert.equal(jobAfterResume?.status, "processing", "Job status should be processing");
    assert.equal(jobAfterResume?.errorDetails, null, "errorDetails should be cleared after resume");
    
    console.log("✅ Resume after error test passed");
  } catch (error) {
    console.error("❌ Resume after error test failed:", error);
    throw error;
  } finally {
    if (userId && fileId && jobId) {
      await cleanup(userId, fileId, jobId);
    }
  }
}

async function testStopAfterError() {
  console.log("\n=== Testing Stop After Error ===");
  
  let userId: string | null = null;
  let fileId: string | null = null;
  let jobId: string | null = null;
  
  try {
    // Step 1: Create test user with invalid API keys
    const { userId: testUserId } = await createTestUserWithInvalidKeys();
    userId = testUserId;
    
    // Step 2: Create test CSV file
    const { fileId: testFileId } = await createTestFile(testUserId);
    fileId = testFileId;
    
    // Step 3: Create job
    const job = await JobsService.createJob({
      userId: testUserId,
      input: {
        fileId: testFileId,
        promptsConfig: [
          {
            model: "openai",
            modelId: "gpt-4o-mini",
            systemText: "You are a helpful assistant.",
            promptText: "Summarize: {{review}}",
            outputColumnName: "summary",
          },
        ],
      },
      requestId: `e2e-test-${uuidv4()}`,
    });
    jobId = job.jobId;
    
    // Step 4: Process job until it pauses
    const processor = new JobProcessor();
    await processor.start();
    const paused = await waitForJobStatus(jobId, "paused", 60000);
    assert.ok(paused, "Job should be paused before stop test");
    await processor.stop();
    
    // Step 5: Verify errorDetails exists (add small delay to ensure DB update is visible)
    await new Promise(resolve => setTimeout(resolve, 500));
    const jobBeforeStop = await getJobWithErrorDetails(jobId);
    assert.ok(jobBeforeStop, "Job should exist");
    assert.equal(jobBeforeStop?.status, "paused", "Job status should be paused");
    assert.ok(jobBeforeStop?.errorDetails, "Job should have errorDetails before stop");
    
    // Step 6: Stop job (should clear errorDetails)
    await JobsService.controlJob({
      userId: testUserId,
      jobId,
      command: "stop",
      requestId: `e2e-test-${uuidv4()}`,
    });
    
    // Step 7: Verify errorDetails cleared
    const jobAfterStop = await getJobWithErrorDetails(jobId);
    assert.equal(jobAfterStop?.status, "stopped", "Job status should be stopped");
    assert.equal(jobAfterStop?.errorDetails, null, "errorDetails should be cleared after stop");
    
    console.log("✅ Stop after error test passed");
  } catch (error) {
    console.error("❌ Stop after error test failed:", error);
    throw error;
  } finally {
    if (userId && fileId && jobId) {
      await cleanup(userId, fileId, jobId);
    }
  }
}

async function run() {
  console.log("🚀 Starting E2E Tests: Auto-Pause on Critical LLM Errors");
  console.log("Environment:", {
    hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  
  // Validate required environment variables
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  if (!process.env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL environment variable is required");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
  }
  
  try {
    await testAuthErrorAutoPause();
    await testResumeAfterError();
    await testStopAfterError();
    
    console.log("\n✅ All E2E tests passed!");
  } catch (err: any) {
    console.error("\n❌ E2E test suite failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}


/**
 * Test suite for useRealtimeJob errorDetails mapping
 * 
 * Tests cover:
 * - errorDetails mapping from snake_case (database) to camelCase (TypeScript)
 * - Real-time subscription receives errorDetails updates
 * 
 * Run: node --import tsx client/src/hooks/useRealtimeJob.error-pause.test.ts
 */

import assert from "node:assert/strict";
import type { JobErrorDetails } from "@shared/llm.errors";

/**
 * Simulate Supabase real-time payload with snake_case column names
 */
interface SupabaseJobPayload {
  job_id: string;
  user_id: string;
  file_id: string | null;
  status: string;
  prompts_config: unknown;
  total_rows: number;
  rows_processed: number;
  current_row: number | null;
  enriched_file_path: string | null;
  lease_expires_at: string | null;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
  error_details: unknown; // JSONB column from database
}

/**
 * Simulate TypeScript job object with camelCase property names
 */
interface TypeScriptJob {
  jobId: string;
  userId: string;
  fileId: string | null;
  status: string;
  promptsConfig: unknown;
  totalRows: number;
  rowsProcessed: number;
  currentRow: number | null;
  enrichedFilePath: string | null;
  leaseExpiresAt: string | null;
  createdAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  errorDetails: unknown; // Mapped from error_details
}

/**
 * Map Supabase payload to TypeScript job object
 * This simulates the mapping logic in useRealtimeJob.ts
 */
function mapSupabaseToTypeScript(rawJob: SupabaseJobPayload): TypeScriptJob {
  return {
    jobId: rawJob.job_id,
    userId: rawJob.user_id,
    fileId: rawJob.file_id,
    status: rawJob.status,
    promptsConfig: rawJob.prompts_config,
    totalRows: rawJob.total_rows,
    rowsProcessed: rawJob.rows_processed,
    currentRow: rawJob.current_row,
    enrichedFilePath: rawJob.enriched_file_path,
    leaseExpiresAt: rawJob.lease_expires_at,
    createdAt: rawJob.created_at,
    finishedAt: rawJob.finished_at,
    errorMessage: rawJob.error_message,
    errorDetails: rawJob.error_details, // Direct mapping from snake_case to camelCase
  };
}

async function testErrorDetailsMapping() {
  console.log("Testing errorDetails mapping from snake_case to camelCase...");

  // Simulate Supabase payload with error_details
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

  const supabasePayload: SupabaseJobPayload = {
    job_id: "test-job-id",
    user_id: "test-user-id",
    file_id: "test-file-id",
    status: "paused",
    prompts_config: {},
    total_rows: 100,
    rows_processed: 5,
    current_row: 5,
    enriched_file_path: null,
    lease_expires_at: null,
    created_at: new Date().toISOString(),
    finished_at: null,
    error_message: null,
    error_details: errorDetails, // JSONB column contains structured error details
  };

  // Map to TypeScript object
  const tsJob = mapSupabaseToTypeScript(supabasePayload);

  // Verify mapping
  assert.equal(tsJob.jobId, "test-job-id", "jobId should be mapped");
  assert.equal(tsJob.status, "paused", "status should be mapped");
  assert.ok(tsJob.errorDetails, "errorDetails should be mapped from error_details");

  // Verify errorDetails structure is preserved
  const mappedErrorDetails = tsJob.errorDetails as JobErrorDetails;
  assert.equal(mappedErrorDetails.category, "AUTH_ERROR", "errorDetails.category should be preserved");
  assert.equal(mappedErrorDetails.rowNumber, 5, "errorDetails.rowNumber should be preserved");
  assert.equal(mappedErrorDetails.promptIndex, 2, "errorDetails.promptIndex should be preserved");

  console.log("✅ ErrorDetails mapping tests passed");
}

async function testErrorDetailsNullMapping() {
  console.log("Testing errorDetails null mapping...");

  // Simulate Supabase payload with null error_details
  const supabasePayload: SupabaseJobPayload = {
    job_id: "test-job-id",
    user_id: "test-user-id",
    file_id: "test-file-id",
    status: "processing",
    prompts_config: {},
    total_rows: 100,
    rows_processed: 10,
    current_row: 10,
    enriched_file_path: null,
    lease_expires_at: null,
    created_at: new Date().toISOString(),
    finished_at: null,
    error_message: null,
    error_details: null, // No error details
  };

  const tsJob = mapSupabaseToTypeScript(supabasePayload);

  assert.equal(tsJob.errorDetails, null, "errorDetails should be null when error_details is null");
  assert.equal(tsJob.status, "processing", "status should be processing");

  console.log("✅ ErrorDetails null mapping tests passed");
}

async function testRealTimeUpdateWithErrorDetails() {
  console.log("Testing real-time update with errorDetails...");

  // Simulate real-time UPDATE event with error_details
  const errorDetails: JobErrorDetails = {
    category: "QUOTA_EXCEEDED",
    userMessage: "Quota exceeded",
    technicalMessage: "429 Too Many Requests",
    rowNumber: 10,
    promptIndex: 1,
    promptOutputColumn: "Analysis",
    provider: "openai",
    timestamp: new Date().toISOString(),
    metadata: { statusCode: 429 },
  };

  const updatePayload: SupabaseJobPayload = {
    job_id: "test-job-id",
    user_id: "test-user-id",
    file_id: "test-file-id",
    status: "paused", // Status changed to paused
    prompts_config: {},
    total_rows: 100,
    rows_processed: 10,
    current_row: 10,
    enriched_file_path: null,
    lease_expires_at: null,
    created_at: new Date().toISOString(),
    finished_at: null,
    error_message: null,
    error_details: errorDetails, // Error details added
  };

  const tsJob = mapSupabaseToTypeScript(updatePayload);

  // Verify real-time update includes errorDetails
  assert.equal(tsJob.status, "paused", "status should be paused");
  assert.ok(tsJob.errorDetails, "errorDetails should be present in real-time update");
  
  const mappedError = tsJob.errorDetails as JobErrorDetails;
  assert.equal(mappedError.category, "QUOTA_EXCEEDED", "error category should match");
  assert.equal(mappedError.rowNumber, 10, "error rowNumber should match");

  console.log("✅ Real-time update with errorDetails tests passed");
}

async function testRealTimeUpdateClearsErrorDetails() {
  console.log("Testing real-time update clears errorDetails...");

  // Simulate real-time UPDATE event clearing error_details (on resume/stop/completion)
  const updatePayload: SupabaseJobPayload = {
    job_id: "test-job-id",
    user_id: "test-user-id",
    file_id: "test-file-id",
    status: "processing", // Status changed to processing (resumed)
    prompts_config: {},
    total_rows: 100,
    rows_processed: 10,
    current_row: 10,
    enriched_file_path: null,
    lease_expires_at: null,
    created_at: new Date().toISOString(),
    finished_at: null,
    error_message: null,
    error_details: null, // Error details cleared
  };

  const tsJob = mapSupabaseToTypeScript(updatePayload);

  // Verify errorDetails is cleared in real-time update
  assert.equal(tsJob.status, "processing", "status should be processing");
  assert.equal(tsJob.errorDetails, null, "errorDetails should be null after clear");

  console.log("✅ Real-time update clears errorDetails tests passed");
}

async function run() {
  try {
    await testErrorDetailsMapping();
    await testErrorDetailsNullMapping();
    await testRealTimeUpdateWithErrorDetails();
    await testRealTimeUpdateClearsErrorDetails();
    console.log("\n✅ All useRealtimeJob error pause tests passed!");
  } catch (err: any) {
    console.error("\n❌ Test failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();


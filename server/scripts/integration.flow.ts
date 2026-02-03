// This file previously hosted an integration test runner used for manual testing.
// It has been intentionally disabled as part of the repository-wide test cleanup.
// Keeping a placeholder with clear guidance prevents accidental reintroduction via stale scripts.

export {};

/**
 * Integration flow driver for local testing without hitting HTTP endpoints.
 *
 * Steps:
 * 1) Seed a user, upload a CSV to Storage, insert `files` and `enrichment_jobs` rows
 * 2) Start the background worker (separately) so it can claim the job
 * 3) Pause → Resume → Stop the job by directly updating DB status to exercise control flow
 * 4) Print job logs and confirm partial artifact presence
 *
 * Notes:
 * - LLM API keys are not required; the worker will mark cells as LLM_ERROR on failures, which is acceptable
 *   for control-flow testing.
 */

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedUserAndFile() {
  const userId = uuidv4();
  const email = `test-user+${userId.slice(0, 8)}@example.com`;

  // Create user row (llmApiKeys left null for this test)
  await db.insert(users).values({ userId, email, llmApiKeys: null });

  // Create and upload a small CSV with a single header `review` and 6 rows
  const csvRows = [
    "review",
    "Great product",
    "Bad service",
    "Average",
    "Excellent value",
    "Could be better",
    "Terrible support",
  ];
  const csvContent = csvRows.join("\n") + "\n";
  const fileBuffer = Buffer.from(csvContent, "utf8");

  const fileId = uuidv4();
  const storagePath = `uploads/${userId}/${fileId}.csv`;
  // ensure bucket exists before upload to avoid 404 and log buckets for diagnostics
  await supabaseService.ensureBucketExists("oracle-files");

  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const debugSb = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: buckets } = await debugSb.storage.listBuckets();
    console.log(
      "[integration] Buckets:",
      (buckets || []).map((b) => b.name),
    );
  } catch (e) {
    console.warn("[integration] Failed to list buckets:", e);
  }

  const uploadRes = await supabaseService.uploadFile(storagePath, fileBuffer);
  if (!uploadRes.data) {
    console.error("[integration] Upload error:", uploadRes.error);
    throw new Error("Failed to upload test CSV to Storage");
  }

  // Insert file metadata (rowCount excludes header line)
  const rowCount = csvRows.length - 1;
  const columnHeaders = ["review"]; // matches CSV header
  await db.insert(files).values({
    fileId,
    userId,
    storagePath,
    originalName: "integration_test.csv",
    rowCount,
    columnHeaders,
  });

  return { userId, fileId, storagePath, rowCount };
}

async function createJob(userId: string, fileId: string, totalRows: number) {
  const jobId = uuidv4();
  const promptsConfig = [
    {
      promptText: "Classify the sentiment (positive/neutral/negative): {{review}}",
      outputColumnName: "sentiment",
      model: "openai",
    },
  ];

  await db
    .insert(enrichmentJobs)
    .values({
      jobId,
      userId,
      fileId,
      promptsConfig,
      totalRows,
      status: "queued",
    })
    .returning();

  return jobId;
}

async function waitForStatus(jobId: string, desired: EnrichmentJob["status"], timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await db
      .select()
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.jobId, jobId))
      .limit(1);
    if (rows.length && rows[0].status === desired) return rows[0];
    await sleep(500);
  }
  throw new Error(`Timeout waiting for job ${jobId} to reach status ${desired}`);
}

async function waitForRowsProcessed(jobId: string, minRows: number, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await db
      .select()
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.jobId, jobId))
      .limit(1);
    if (rows.length && (rows[0].rowsProcessed || 0) >= minRows) return rows[0];
    await sleep(500);
  }
  throw new Error(`Timeout waiting for job ${jobId} rowsProcessed >= ${minRows}`);
}

async function setJobStatus(jobId: string, status: EnrichmentJob["status"]) {
  await db
    .update(enrichmentJobs)
    .set({ status: status as any })
    .where(eq(enrichmentJobs.jobId, jobId));
}

async function getJobLogs(jobId: string) {
  const logs = await db
    .select()
    .from(jobLogs)
    .where(eq(jobLogs.jobId, jobId))
    .orderBy(desc(jobLogs.timestamp));
  return logs.reverse();
}

async function main() {
  console.log("[integration] Seeding user and file...");
  const { userId, fileId, rowCount } = await seedUserAndFile();

  console.log("[integration] Creating job (queued)...");
  const jobId = await createJob(userId, fileId, rowCount);
  console.log("[integration] Job created:", { jobId, userId, fileId, rowCount });

  console.log(
    "[integration] Start the worker in another terminal if not already running: node --import tsx worker/index.ts",
  );

  console.log("[integration] Waiting for job to enter processing...");
  await waitForStatus(jobId, "processing");
  console.log("[integration] Job is processing.");

  console.log("[integration] Waiting for at least 2 rows processed before pausing...");
  const beforePause = await waitForRowsProcessed(jobId, 2);
  console.log("[integration] rowsProcessed before pause:", beforePause.rowsProcessed);

  console.log("[integration] Pausing job...");
  await setJobStatus(jobId, "paused");
  await sleep(2000);
  const paused = await waitForStatus(jobId, "paused");
  console.log("[integration] Job is paused at rowsProcessed=", paused.rowsProcessed);

  console.log("[integration] Resuming job...");
  await setJobStatus(jobId, "processing");
  await sleep(1000);
  console.log("[integration] Waiting for more progress after resume...");
  const afterResume = await waitForRowsProcessed(jobId, (beforePause.rowsProcessed || 0) + 1);
  console.log("[integration] rowsProcessed after resume:", afterResume.rowsProcessed);

  console.log("[integration] Stopping job (to test partial artifact)...");
  await setJobStatus(jobId, "stopped");
  await sleep(2000);

  // Check partial exists
  const partialPath = `enriched/${userId}/${jobId}_partial.csv`;
  const partialUrl = await supabaseService.getSignedUrl(partialPath);
  console.log("[integration] Partial URL available?", Boolean(partialUrl));

  // Print last 20 logs
  const logs = await getJobLogs(jobId);
  console.log("[integration] Last logs:");
  for (const l of logs.slice(-20)) {
    console.log(`${l.timestamp?.toISOString?.() || ""} [${l.level}] ${l.message}`);
  }

  console.log("[integration] Done.");
}

main().catch((err) => {
  console.error("[integration] FAILED:", err);
  process.exit(1);
});

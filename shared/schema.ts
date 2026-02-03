import { pgTable, text, uuid, integer, timestamp, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { isAllowedModelId } from "./llm.models";

export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  llmApiKeys: jsonb("llm_api_keys"), // Encrypted JSON: { "openai": "encrypted_key", "perplexity": "encrypted_key", "gemini": "encrypted_key" }
});

export const files = pgTable("files", {
  fileId: uuid("file_id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  storagePath: text("storage_path").notNull(),
  originalName: text("original_name").notNull(),
  rowCount: integer("row_count").notNull(),
  columnHeaders: jsonb("column_headers").notNull(), // Array of strings
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const enrichmentJobs = pgTable("enrichment_jobs", {
  jobId: uuid("job_id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.fileId),
  status: text("status", {
    enum: ["queued", "processing", "completed", "failed", "paused", "stopped"],
  })
    .notNull()
    .default("queued"),
  promptsConfig: jsonb("prompts_config").notNull(), // Array of prompt objects
  totalRows: integer("total_rows").notNull(),
  rowsProcessed: integer("rows_processed").notNull().default(0),
  // Nullable: reflects the 1-based row currently being iterated, if any
  currentRow: bigint("current_row", { mode: "number" }),
  enrichedFilePath: text("enriched_file_path"),
  // Phase 5: lease expiration enables reclaiming stuck processing jobs
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  // Structured error details when job is auto-paused due to critical LLM errors
  errorDetails: jsonb("error_details"),
});

export const promptTemplates = pgTable("prompt_templates", {
  promptId: uuid("prompt_id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  name: text("name").notNull(),
  promptText: text("prompt_text").notNull(),
  model: text("model", { enum: ["openai", "gemini", "perplexity", "deepseek", "anthropic"] }).notNull(),
  // Nullable at DB level for legacy rows; app-level validation requires it going forward
  modelId: text("model_id"),
  outputColumnName: text("output_column_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const systemTemplates = pgTable("system_templates", {
  systemTemplateId: uuid("system_template_id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  name: text("name").notNull(),
  systemText: text("system_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobLogs = pgTable("job_logs", {
  logId: uuid("log_id").primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => enrichmentJobs.jobId, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  level: text("level", { enum: ["INFO", "ERROR", "WARN"] }).notNull(),
  message: text("message").notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  userId: true,
  createdAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  fileId: true,
  createdAt: true,
});

export const insertEnrichmentJobSchema = createInsertSchema(enrichmentJobs).omit({
  jobId: true,
  createdAt: true,
  finishedAt: true,
});

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({
  promptId: true,
  createdAt: true,
});

export const insertSystemTemplateSchema = createInsertSchema(systemTemplates).omit({
  systemTemplateId: true,
  createdAt: true,
});

export const insertJobLogSchema = createInsertSchema(jobLogs).omit({
  logId: true,
  timestamp: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type EnrichmentJob = typeof enrichmentJobs.$inferSelect;
export type InsertEnrichmentJob = z.infer<typeof insertEnrichmentJobSchema>;

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;

export type SystemTemplate = typeof systemTemplates.$inferSelect;
export type InsertSystemTemplate = z.infer<typeof insertSystemTemplateSchema>;

export type JobLog = typeof jobLogs.$inferSelect;
export type InsertJobLog = z.infer<typeof insertJobLogSchema>;

// Additional schemas for API validation
export const promptConfigSchema = z.object({
  systemText: z.string().optional(),
  promptText: z.string().min(1),
  outputColumnName: z.string().min(1),
  model: z.enum(["openai", "gemini", "perplexity", "deepseek", "anthropic"]),
  // Explicit model selection is required – no provider defaults
  modelId: z.string().min(1),
}).superRefine((val, ctx) => {
  const ok = isAllowedModelId(val.model as any, val.modelId);
  if (!ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["modelId"],
      message: `Model ID not allowed for provider ${val.model}`,
    });
  }
});

// Stricter app-level schema for template creation/update
export const appInsertPromptTemplateSchema = createInsertSchema(promptTemplates)
  .omit({ promptId: true, createdAt: true })
  .extend({ modelId: z.string().min(1) });

export const createJobSchema = z
  .object({
    fileId: z.string().uuid(),
    promptsConfig: z.array(promptConfigSchema).min(1),
    // Explicit queue override: allow creating a job even when an active job exists
    // When true, the service will skip the active-job block and queue this job.
    forceQueue: z.boolean().optional(),
    // Optional job-level options; defaults applied server/worker-side if absent
    options: z
      .object({
        skipIfExistingValue: z.boolean().optional(),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    // Enforce uniqueness of outputColumnName across prompts
    const seen = new Map<string, number[]>();
    val.promptsConfig.forEach((p, idx) => {
      const key = p.outputColumnName.trim();
      if (!key) return;
      const arr = seen.get(key) || [];
      arr.push(idx);
      seen.set(key, arr);
    });
    const duplicates = Array.from(seen.entries()).filter(([, idxs]) => idxs.length > 1);
    if (duplicates.length > 0) {
      const names = duplicates.map(([name]) => name);
      // Attach an issue per offending prompt index for better UX
      for (const [, idxs] of duplicates) {
        for (const i of idxs) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["promptsConfig", i, "outputColumnName"],
            message: `Duplicate output column name detected. Each outputColumnName must be unique.`,
          });
        }
      }
      // Also add a form-level issue listing duplicates for clarity
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate outputColumnName values: ${names.join(", ")}`,
      });
    }
  });

export const jobControlSchema = z.object({
  command: z.enum(["pause", "resume", "stop"]),
});

// Job options schema (control-file driven; no DB column)
export const jobOptionsSchema = z.object({
  skipIfExistingValue: z.boolean(),
});

// Allow null to explicitly indicate deletion of a key; undefined means "no change"
export const apiKeysSchema = z.object({
  openai: z.string().nullable().optional(),
  gemini: z.string().nullable().optional(),
  perplexity: z.string().nullable().optional(),
  deepseek: z.string().nullable().optional(),
  anthropic: z.string().nullable().optional(),
});

export type PromptConfig = z.infer<typeof promptConfigSchema>;
export type CreateJobRequest = z.infer<typeof createJobSchema>;
export type JobControlRequest = z.infer<typeof jobControlSchema>;
export type JobOptionsRequest = z.infer<typeof jobOptionsSchema>;
export type ApiKeysRequest = z.infer<typeof apiKeysSchema>;

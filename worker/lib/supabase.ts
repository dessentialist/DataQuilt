import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { supabaseService as sharedSupabaseService } from "@shared/supabaseStorage";
import * as schema from "@shared/schema";
import { logInfo, logWarn } from "@shared/logger";
import fs from "fs";

// Database connection
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const connectionString = process.env.DATABASE_URL;

// Determine sslmode from the URL for observability (does not mutate URL)
let sslMode: string | undefined;
try {
  const url = new URL(connectionString);
  sslMode = url.searchParams.get("sslmode") ?? undefined;
} catch {
  // ignore parse errors
}

// Load CA certificate from either a file path or base64-encoded env var
let caSource: "path" | "env_b64" | "system_ca" = "system_ca";
let caContents: string | undefined;
try {
  if (process.env.DATABASE_CA_CERT_PATH) {
    caContents = fs.readFileSync(process.env.DATABASE_CA_CERT_PATH, "utf8");
    caSource = "path";
  } else if (process.env.DATABASE_CA_CERT_B64) {
    caContents = Buffer.from(process.env.DATABASE_CA_CERT_B64, "base64").toString("utf8");
    caSource = "env_b64";
  }
} catch {
  caSource = "system_ca";
}

const sql = postgres(connectionString, {
  max: 1,
  ssl: caContents
    ? { ca: caContents, rejectUnauthorized: true }
    : { rejectUnauthorized: true },
});

// Non-sensitive startup log to confirm TLS posture
logInfo("worker_database_client_initialized", {
  component: "worker-database",
  sslMode: sslMode ?? "unknown",
  caSource,
});
if (!sslMode || (sslMode !== "verify-full" && sslMode !== "require")) {
  logWarn("worker_database_sslmode_missing_or_weak", {
    component: "worker-database",
    hint: "Append ?sslmode=verify-full to DATABASE_URL for strict verification",
  });
}

export const db = drizzle(sql, { schema });

export const supabaseService = sharedSupabaseService;

// Enforce strict verify-full in production environments
if (process.env.NODE_ENV === "production" && sslMode !== "verify-full") {
  throw new Error(
    "DATABASE_URL must include sslmode=verify-full in production to enforce strict certificate verification (worker).",
  );
}

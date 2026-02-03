import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import { logInfo, logWarn } from "@shared/logger";
import fs from "fs";

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
  // ignore parse errors; some drivers accept slightly nonstandard URLs
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
  // Fall back to system CA store; driver will still enforce TLS
  caSource = "system_ca";
}

const sql = postgres(connectionString, {
  max: 1,
  // Enforce TLS; prefer supplied CA, otherwise rely on system trust store
  ssl: caContents
    ? { ca: caContents, rejectUnauthorized: true }
    : { rejectUnauthorized: true },
});

// Non-sensitive startup log to confirm TLS posture
logInfo("database_client_initialized", {
  component: "database",
  sslMode: sslMode ?? "unknown",
  caSource,
});
if (!sslMode || (sslMode !== "verify-full" && sslMode !== "require")) {
  logWarn("database_sslmode_missing_or_weak", {
    component: "database",
    hint: "Append ?sslmode=verify-full to DATABASE_URL for strict verification",
  });
}

export const db = drizzle(sql, { schema });

// Enforce strict verify-full in production environments
if (process.env.NODE_ENV === "production" && sslMode !== "verify-full") {
  throw new Error(
    "DATABASE_URL must include sslmode=verify-full in production to enforce strict certificate verification.",
  );
}

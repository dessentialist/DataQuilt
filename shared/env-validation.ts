/**
 * Environment variable validation utility
 * Ensures all required environment variables are present and valid at startup
 */

import { logError, logInfo } from "./logger";

export interface EnvConfig {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  NODE_ENV: string;
  // Optional LLM API keys
  OPENAI_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "ENCRYPTION_KEY",
] as const;

const OPTIONAL_ENV_VARS = ["OPENAI_API_KEY", "PERPLEXITY_API_KEY", "ANTHROPIC_API_KEY"] as const;

/**
 * Validates all required environment variables are present and meet basic requirements
 * @throws Error if validation fails
 */
export function validateEnvironment(): EnvConfig {
  const missing: string[] = [];
  const invalid: string[] = [];

  // Check required environment variables
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    if (!value) {
      missing.push(envVar);
      continue;
    }

    // Specific validation rules
    if (envVar === "ENCRYPTION_KEY") {
      // Must be exactly 32 bytes when base64 decoded
      try {
        const decoded = Buffer.from(value, "base64");
        if (decoded.length !== 32) {
          invalid.push(`${envVar} (must be 32 bytes when base64 decoded, got ${decoded.length})`);
        }
      } catch (error) {
        invalid.push(`${envVar} (invalid base64 encoding)`);
      }
    }

    if (envVar === "SUPABASE_URL" && !value.startsWith("https://")) {
      invalid.push(`${envVar} (must start with https://)`);
    }

    if (envVar === "DATABASE_URL" && !value.startsWith("postgresql://")) {
      invalid.push(`${envVar} (must be a valid PostgreSQL connection string)`);
    }
  }

  // Report validation results
  if (missing.length > 0) {
    logError("env_validation_missing", { missing });
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (invalid.length > 0) {
    logError("env_validation_invalid", { invalid });
    throw new Error(`Invalid environment variables: ${invalid.join(", ")}`);
  }

  // Log optional variables that are missing (informational)
  const missingOptional = OPTIONAL_ENV_VARS.filter((envVar) => !process.env[envVar]);
  if (missingOptional.length > 0) {
    logInfo("env_validation_optional_missing", { missingOptional });
  }

  // Set NODE_ENV default if not specified
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
  }

  logInfo("env_validation_success", {
    environment: process.env.NODE_ENV,
    hasOptionalKeys: OPTIONAL_ENV_VARS.filter((envVar) => !!process.env[envVar]),
  });

  // Return validated configuration object
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET!,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
    NODE_ENV: process.env.NODE_ENV!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
}

#!/usr/bin/env node
/* global console, process, Buffer */

/**
 * Environment check script to validate configuration before startup
 */

import crypto from "crypto";

console.log("🔍 Checking environment configuration...\n");

const requiredVars = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "ENCRYPTION_KEY",
];

const optionalVars = ["OPENAI_API_KEY", "PERPLEXITY_API_KEY"];

let hasErrors = false;

// Check required variables
console.log("Required Environment Variables:");
requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (!value) {
    console.log(`❌ ${varName}: MISSING`);
    hasErrors = true;
  } else {
    // Special validation for ENCRYPTION_KEY
    if (varName === "ENCRYPTION_KEY") {
      try {
        const decoded = Buffer.from(value, "base64");
        if (decoded.length === 32) {
          console.log(`✅ ${varName}: Valid (32 bytes)`);
        } else {
          console.log(`❌ ${varName}: Invalid size (${decoded.length} bytes, need 32)`);
          console.log(`   Current key: ${value}`);
          console.log(`   Suggested key: ${crypto.randomBytes(32).toString("base64")}`);
          hasErrors = true;
        }
      } catch (error) {
        console.log(`❌ ${varName}: Invalid base64 encoding`);
        hasErrors = true;
      }
    } else {
      console.log(`✅ ${varName}: Present`);
    }
  }
});

console.log("\nOptional Environment Variables:");
optionalVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: Present`);
  } else {
    console.log(`⚠️  ${varName}: Not set (optional)`);
  }
});

console.log(`\nEnvironment: ${process.env.NODE_ENV || "development"}`);

if (hasErrors) {
  console.log("\n❌ Environment validation failed. Please fix the issues above.");
  process.exit(1);
} else {
  console.log("\n✅ All environment variables are properly configured!");
}

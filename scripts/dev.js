#!/usr/bin/env node
/* global console, process */

/**
 * Development startup script that runs both API server and worker processes
 * This script is used to ensure both processes start correctly on Replit
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

process.env.NODE_ENV = process.env.NODE_ENV || "development";

console.log("🚀 Starting Oracle Development Environment...");
console.log(`Environment: ${process.env.NODE_ENV}`);

// Process references for cleanup
const processes = [];

// Cleanup function to kill all child processes
function cleanup() {
  console.log("\n🛑 Shutting down processes...");
  processes.forEach((proc, index) => {
    if (proc && !proc.killed) {
      console.log(`Killing process ${index + 1}...`);
      proc.kill("SIGTERM");
    }
  });
  process.exit(0);
}

// Handle process termination signals
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

// Start API server
const apiServer = spawn("tsx", ["server/index.ts"], {
  cwd: rootDir,
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "1" },
});

processes.push(apiServer);

apiServer.stdout.on("data", (data) => {
  process.stdout.write(`[API] ${data}`);
});

apiServer.stderr.on("data", (data) => {
  process.stderr.write(`[API] ${data}`);
});

apiServer.on("exit", (code) => {
  console.log(`[API] Process exited with code ${code}`);
  cleanup();
});

// Start worker process
const worker = spawn("tsx", ["worker/index.ts"], {
  cwd: rootDir,
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "1" },
});

processes.push(worker);

worker.stdout.on("data", (data) => {
  process.stdout.write(`[WORKER] ${data}`);
});

worker.stderr.on("data", (data) => {
  process.stderr.write(`[WORKER] ${data}`);
});

worker.on("exit", (code) => {
  console.log(`[WORKER] Process exited with code ${code}`);
  cleanup();
});

console.log("✅ Both processes started successfully");
console.log("Press Ctrl+C to stop all processes");

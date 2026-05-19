#!/usr/bin/env node
/* global console, process */

/**
 * Production startup script for Oracle platform
 * Runs both API server and worker processes with proper error handling
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

process.env.NODE_ENV = "production";

console.log("🚀 Starting Oracle Production Environment...");

const processes = [];

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

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

// Start production API server
const apiServer = spawn("node", ["dist/index.js"], {
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
  if (code !== 0) {
    cleanup();
  }
});

// Start production worker
const worker = spawn("node", ["dist/worker/index.js"], {
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
  if (code !== 0) {
    cleanup();
  }
});

console.log("✅ Production processes started");

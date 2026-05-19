import { jobProcessor } from "./services/job.processor";

// Validate all environment variables early so misconfigurations fail fast
try {
  const { validateEnvironment } = await import("../shared/env-validation");
  validateEnvironment();

  // Validate encryption key specifically
  await import("../shared/crypto");
} catch (error) {
  console.error("FATAL (worker): Environment validation failed:", error);
  process.exit(1);
}

console.log("🚀 Oracle Background Worker starting...");

async function main() {
  try {
    // Start the job processor
    await jobProcessor.start();
    console.log("✅ Background worker started successfully");

    // Setup heartbeat logging every 60 seconds to show worker is alive
    const heartbeatInterval = setInterval(() => {
      console.log(`💓 Worker heartbeat - ${new Date().toISOString()}`);
    }, 60000);

    // Keep the process alive
    process.on("SIGINT", async () => {
      console.log("📥 Received SIGINT, shutting down gracefully...");
      clearInterval(heartbeatInterval);
      await jobProcessor.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("📥 Received SIGTERM, shutting down gracefully...");
      clearInterval(heartbeatInterval);
      await jobProcessor.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start background worker:", error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

main();

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

/**
 * Usage:
 *   node scripts/with-db-ca.js <command> [args...]
 * 
 * Behavior:
 * - If DATABASE_CA_CERT_PATH is set, uses that path for NODE_EXTRA_CA_CERTS.
 * - Else if DATABASE_CA_CERT_B64 is set, materializes a temp PEM file and uses it.
 * - Else, runs the command without modifying NODE_EXTRA_CA_CERTS (relies on system trust store).
 * - Forwards exit code from the child process.
 * 
 * This is helpful for Drizzle CLI commands (e.g., drizzle-kit push) when using sslmode=verify-full.
 */
(async function main() {
  const [, , ...args] = process.argv;
  if (args.length === 0) {
    // eslint-disable-next-line no-console
    console.error("Usage: node scripts/with-db-ca.js <command> [args...]");
    process.exit(2);
  }

  let extraCaPath = process.env.DATABASE_CA_CERT_PATH || "";
  let tmpPath = "";

  try {
    if (!extraCaPath && process.env.DATABASE_CA_CERT_B64) {
      const pemContents = Buffer.from(process.env.DATABASE_CA_CERT_B64, "base64").toString("utf8");
      const tmpDir = os.tmpdir();
      tmpPath = path.join(tmpDir, `supabase-ca-${Date.now()}.pem`);
      fs.writeFileSync(tmpPath, pemContents, { encoding: "utf8", mode: 0o600 });
      extraCaPath = tmpPath;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[with-db-ca] Failed to prepare CA file; proceeding without NODE_EXTRA_CA_CERTS:",
      err instanceof Error ? err.message : String(err),
    );
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  const childEnv = {
    ...process.env,
    ...(extraCaPath ? { NODE_EXTRA_CA_CERTS: extraCaPath } : {}),
  };

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: "INFO",
      ts: new Date().toISOString(),
      msg: "[with-db-ca] launching command",
      command,
      args: commandArgs,
      caSource: process.env.DATABASE_CA_CERT_PATH ? "path" : process.env.DATABASE_CA_CERT_B64 ? "env_b64" : "system_ca",
      setNodeExtraCaCerts: Boolean(extraCaPath),
    }),
  );

  const child = spawn(command, commandArgs, {
    stdio: "inherit",
    shell: true,
    env: childEnv,
  });

  child.on("exit", (code, signal) => {
    if (tmpPath) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore cleanup errors
      }
    }
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
})();




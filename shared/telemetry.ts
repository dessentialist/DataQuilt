// Server-side telemetry and auditing helper.
// Currently logs to console in a structured format; can be wired to an external sink later.

export type AuditEvent =
  | "account_delete_requested"
  | "account_deleted"
  | "account_delete_failed";

export function trackAudit(event: AuditEvent, properties: Record<string, unknown> = {}): void {
  const payload = {
    event,
    ts: new Date().toISOString(),
    ...properties,
  };
  // eslint-disable-next-line no-console
  console.info("audit", JSON.stringify(payload));
}



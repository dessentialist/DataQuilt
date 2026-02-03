// Lightweight client-side telemetry utility.
// For Phase 8 we log to console in a structured way. Later we can forward to a backend.

export type TelemetryEvent =
  | "upload_start"
  | "upload_success"
  | "upload_error"
  | "preview_start"
  | "preview_success"
  | "preview_error"
  | "job_start"
  | "job_start_success"
  | "job_start_error"
  | "job_control"
  | "job_control_error"
  | "download_request"
  | "download_success"
  | "download_error"
  | "download_original_success"
  | "download_original_error"
  | "history_filter_changed"
  | "history_filter_applied";

export function track(event: TelemetryEvent, properties: Record<string, unknown> = {}) {
  const payload = {
    event,
    ts: new Date().toISOString(),
    ...properties,
  };
  // eslint-disable-next-line no-console
  console.info("telemetry", JSON.stringify(payload));
}

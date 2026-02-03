import { ZodError } from "zod";
import { ERROR_CATALOG, type ErrorCode } from "@shared/errors";

/**
 * Maps known error types to HTTP status and structured body.
 * Keep minimal for pilot: Zod validation -> 400, default -> 500.
 */
export function mapErrorToHttp(
  err: unknown,
  opts?: { invalidCode?: ErrorCode }
) {
  // If the error includes a known code, honor it
  if (typeof err === "object" && err && (err as any).code) {
    const code = (err as any).code as ErrorCode;
    const spec = ERROR_CATALOG[code] ?? ERROR_CATALOG.GENERAL_INTERNAL_ERROR;
    // Pass through optional structured details when present
    const details = (err as any).details;
    return { status: spec.httpStatus, body: { code, message: spec.defaultMessage, ...(details ? { details } : {}) } } as const;
  }

  // Zod validation errors → map to provided invalidCode when available
  if (err instanceof ZodError) {
    if (opts?.invalidCode && ERROR_CATALOG[opts.invalidCode]) {
      const spec = ERROR_CATALOG[opts.invalidCode];
      return {
        status: spec.httpStatus,
        body: { code: opts.invalidCode, message: spec.defaultMessage, details: err.flatten?.() },
      } as const;
    }
    // Fallback if no code provided
    return {
      status: 400,
      body: { code: "GENERAL_INTERNAL_ERROR", message: "Invalid input" },
    } as const;
  }

  const spec = ERROR_CATALOG.GENERAL_INTERNAL_ERROR;
  return { status: spec.httpStatus, body: { code: "GENERAL_INTERNAL_ERROR", message: spec.defaultMessage } } as const;
}



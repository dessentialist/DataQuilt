// Centralized error code taxonomy and helpers

export type ErrorCode =
  | "AUTH_MISSING_TOKEN"
  | "AUTH_TOKEN_INVALID"
  | "AUTH_TOKEN_EXPIRED"
  | "AUTH_NO_SUB"
  | "AUTH_USER_NOT_FOUND"
  | "AUTH_INVALID_INPUT"
  | "SERVER_MISCONFIGURED"
  | "FILES_INVALID_INPUT"
  | "FILES_NO_FILE"
  | "FILES_INVALID_CONTENT"
  | "FILES_EMPTY_OR_INVALID_CSV"
  | "FILES_UPLOAD_FAILED"
  | "JOBS_FILE_NOT_FOUND"
  | "JOBS_CREATE_FAILED"
  | "JOBS_PREVIEW_FAILED"
  | "JOBS_NOT_FOUND"
  | "JOBS_CONTROL_INVALID_COMMAND"
  | "JOBS_DOWNLOAD_NOT_ACCESSIBLE"
  | "JOBS_ACTIVE_JOB_EXISTS"
  | "JOBS_INVALID_INPUT"
  | "TEMPLATES_INVALID_INPUT"
  | "TEMPLATES_NOT_FOUND"
  | "SYSTEM_TEMPLATES_INVALID_INPUT"
  | "SYSTEM_TEMPLATES_NOT_FOUND"
  | "HISTORY_INVALID_INPUT"
  | "GENERAL_INTERNAL_ERROR";

export interface ErrorSpec {
  httpStatus: number;
  defaultMessage: string;
}

export const ERROR_CATALOG: Record<ErrorCode, ErrorSpec> = {
  AUTH_MISSING_TOKEN: { httpStatus: 401, defaultMessage: "Authentication required" },
  AUTH_TOKEN_INVALID: { httpStatus: 401, defaultMessage: "Invalid authentication token" },
  AUTH_TOKEN_EXPIRED: { httpStatus: 401, defaultMessage: "Token expired" },
  AUTH_NO_SUB: { httpStatus: 401, defaultMessage: "Invalid token (missing sub)" },
  AUTH_USER_NOT_FOUND: { httpStatus: 401, defaultMessage: "User not found" },
  AUTH_INVALID_INPUT: { httpStatus: 400, defaultMessage: "Invalid auth data" },
  SERVER_MISCONFIGURED: {
    httpStatus: 500,
    defaultMessage: "Server misconfiguration: missing required environment variable",
  },
  FILES_INVALID_INPUT: { httpStatus: 400, defaultMessage: "Invalid file data" },
  FILES_NO_FILE: { httpStatus: 400, defaultMessage: "No file uploaded" },
  FILES_INVALID_CONTENT: {
    httpStatus: 400,
    defaultMessage: "Uploaded file content does not appear to be a valid CSV",
  },
  FILES_EMPTY_OR_INVALID_CSV: {
    httpStatus: 400,
    defaultMessage: "CSV file is empty or invalid",
  },
  FILES_UPLOAD_FAILED: { httpStatus: 500, defaultMessage: "Failed to upload file to storage" },
  JOBS_FILE_NOT_FOUND: { httpStatus: 404, defaultMessage: "File not found" },
  JOBS_CREATE_FAILED: { httpStatus: 500, defaultMessage: "Failed to create job" },
  JOBS_PREVIEW_FAILED: { httpStatus: 500, defaultMessage: "Failed to generate preview" },
  JOBS_NOT_FOUND: { httpStatus: 404, defaultMessage: "Job not found" },
  JOBS_CONTROL_INVALID_COMMAND: { httpStatus: 400, defaultMessage: "Invalid command" },
  JOBS_DOWNLOAD_NOT_ACCESSIBLE: { httpStatus: 404, defaultMessage: "File not accessible" },
  JOBS_ACTIVE_JOB_EXISTS: { httpStatus: 409, defaultMessage: "You already have an active job. Please stop the current job before starting a new one." },
  JOBS_INVALID_INPUT: { httpStatus: 400, defaultMessage: "Invalid job data" },
  TEMPLATES_INVALID_INPUT: { httpStatus: 400, defaultMessage: "Invalid template data" },
  TEMPLATES_NOT_FOUND: { httpStatus: 404, defaultMessage: "Template not found" },
  SYSTEM_TEMPLATES_INVALID_INPUT: { httpStatus: 400, defaultMessage: "Invalid system template data" },
  SYSTEM_TEMPLATES_NOT_FOUND: { httpStatus: 404, defaultMessage: "System template not found" },
  HISTORY_INVALID_INPUT: { httpStatus: 400, defaultMessage: "Invalid history query" },
  GENERAL_INTERNAL_ERROR: { httpStatus: 500, defaultMessage: "Internal Server Error" },
};

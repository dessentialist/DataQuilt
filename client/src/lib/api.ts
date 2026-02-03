import { apiRequest, apiRequestMultipart } from "./queryClient";
import type {
  CreateJobRequest,
  JobControlRequest,
  ApiKeysRequest,
  InsertPromptTemplate,
  EnrichmentJob,
  JobLog,
  InsertSystemTemplate,
} from "@shared/schema";

export const api = {
  // Authentication
  auth: {
    logout: () => apiRequest("POST", "/api/auth/logout"),
    getSession: () => apiRequest("GET", "/api/auth/session"),
    saveApiKeys: (keys: ApiKeysRequest) => apiRequest("POST", "/api/auth/keys", keys),
  },

  // Files
  files: {
    // Upload CSV to server via standardized multipart helper
    // Returns parsed JSON and centralizes timeout/ok-check (30s default)
    upload: async (formData: FormData) => {
      return apiRequestMultipart("POST", "/api/files/upload", formData, { raw: false, timeoutMs: 30000 });
    },
    downloadUrlById: async (fileId: string) => {
      return apiRequest("GET", `/api/files/${fileId}/download`);
    },
    preview: async (fileId: string) => {
      return apiRequest("GET", `/api/files/${fileId}/preview`);
    },
  },

  // Jobs
  jobs: {
    create: (data: CreateJobRequest) => apiRequest("POST", "/api/jobs", data),
    preview: (data: CreateJobRequest) => apiRequest("POST", "/api/jobs/preview", data),
    get: (jobId: string) => apiRequest("GET", `/api/jobs/${jobId}`),
    control: (jobId: string, command: JobControlRequest) =>
      apiRequest("POST", `/api/jobs/${jobId}/control`, command),
    downloadUrl: (jobId: string) => apiRequest("GET", `/api/jobs/${jobId}/download`),
    logsUrl: (jobId: string) => apiRequest("GET", `/api/jobs/${jobId}/logs`),
    setOptions: (jobId: string, options: { skipIfExistingValue: boolean }) =>
      apiRequest("PATCH", `/api/jobs/${jobId}/options`, options),
  },

  // Templates
  templates: {
    list: () => apiRequest("GET", "/api/templates"),
    create: (template: InsertPromptTemplate) => apiRequest("POST", "/api/templates", template),
    update: (templateId: string, template: Partial<InsertPromptTemplate>) =>
      apiRequest("PUT", `/api/templates/${templateId}`, template),
    delete: (templateId: string) => apiRequest("DELETE", `/api/templates/${templateId}`),
  },

  // System Templates
  systemTemplates: {
    list: () => apiRequest("GET", "/api/system-templates"),
    create: (tpl: InsertSystemTemplate) => apiRequest("POST", "/api/system-templates", tpl),
    update: (systemTemplateId: string, tpl: Partial<InsertSystemTemplate>) =>
      apiRequest("PUT", `/api/system-templates/${systemTemplateId}`, tpl),
    delete: (systemTemplateId: string) => apiRequest("DELETE", `/api/system-templates/${systemTemplateId}`),
  },

  // History
  history: {
    list: (opts?: { status?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (opts?.status) params.set("status", opts.status);
      if (opts?.limit) params.set("limit", String(opts.limit));
      const qs = params.toString();
      return apiRequest("GET", `/api/history${qs ? `?${qs}` : ""}`);
    },
    delete: (jobId: string) => apiRequest("DELETE", `/api/history/${jobId}`),
  },

  // Account
  account: {
    // Return raw Response; callers don't need JSON body here and some environments may send empty bodies
    delete: () => apiRequest("DELETE", "/api/account"),
  },
};

// Align to server contract: { job, logs }
export type JobWithLogs = { job: EnrichmentJob; logs: JobLog[] };
export type FileUploadResponse = {
  fileId: string;
  originalName: string;
  columnHeaders: string[];
  rowCount: number;
};
export type PreviewResponse = {
  previewData: Record<string, any>[];
  detailed?: Array<{
    original: Record<string, any>;
    enriched: Record<string, any>;
    prompts: Array<{
      index: number;
      model: string;
      modelId?: string;
      outputColumnName: string;
      usedVariables: string[];
      systemProcessed?: string;
      userProcessed?: string;
      response: string;
      skipped?: boolean;
    }>;
  }>;
  meta?: { models?: string[]; timestamp?: string; requestId?: string };
};
export type FilePreviewResponse = {
  previewData: Record<string, any>[];
  requestId?: string;
};
export type DownloadUrlResponse = { url: string; requestId?: string };

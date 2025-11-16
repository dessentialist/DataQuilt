// Define a local minimal shape to avoid circular imports.
export interface RequestedLLMOptions {
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
}

/**
 * OpenAI model capability definitions and sanitization helpers.
 * This keeps provider-specific logic out of higher-level services.
 */

export type OpenAIModelId =
  | "gpt-5"
  | "gpt-5-mini"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4.1"
  | "gpt-4.1-mini";

export interface OpenAICapabilities {
  apiSurface: "responses" | "chat";
  supportsTemperature: boolean;
  supportsTopP: boolean;
  supportsPenalties: boolean;
  supportsReasoningEffort: boolean;
  defaultReasoningEffort?: "low" | "medium" | "high";
  defaultMaxTokens: number;
}

const OPENAI_CAPABILITY_MAP: Record<OpenAIModelId, OpenAICapabilities> = {
  "gpt-5": {
    apiSurface: "responses",
    supportsTemperature: false,
    supportsTopP: false,
    supportsPenalties: false,
    supportsReasoningEffort: true,
    defaultReasoningEffort: "high",
    defaultMaxTokens: 128000,
  },
  "gpt-5-mini": {
    apiSurface: "responses",
    supportsTemperature: false,
    supportsTopP: false,
    supportsPenalties: false,
    supportsReasoningEffort: true,
    defaultReasoningEffort: "high",
    defaultMaxTokens: 128000,
  },
  "gpt-4o": {
    apiSurface: "chat",
    supportsTemperature: true,
    supportsTopP: true,
    supportsPenalties: true,
    supportsReasoningEffort: false,
    defaultMaxTokens: 16384,
  },
  "gpt-4o-mini": {
    apiSurface: "chat",
    supportsTemperature: true,
    supportsTopP: true,
    supportsPenalties: true,
    supportsReasoningEffort: false,
    defaultMaxTokens: 16384,
  },
  "gpt-4.1": {
    apiSurface: "chat",
    supportsTemperature: true,
    supportsTopP: true,
    supportsPenalties: true,
    supportsReasoningEffort: false,
    defaultMaxTokens: 32768,
  },
  "gpt-4.1-mini": {
    apiSurface: "chat",
    supportsTemperature: true,
    supportsTopP: true,
    supportsPenalties: true,
    supportsReasoningEffort: false,
    defaultMaxTokens: 32768,
  },
};

export function getOpenAICapabilities(modelId: string): OpenAICapabilities | null {
  if ((OPENAI_CAPABILITY_MAP as any)[modelId]) return (OPENAI_CAPABILITY_MAP as any)[modelId];
  return null;
}

export interface EffectiveOpenAIParams {
  // Constructor-level fields for LangChain ChatOpenAI
  temperature?: number;
  maxTokens?: number;
  // Not yet used: reasoning controls for Responses API
  reasoningEffort?: "low" | "medium" | "high";
  // Diagnostics
  sanitizedFields: Array<{
    field: string;
    action: "dropped" | "overridden";
    reason: string;
    from?: any;
    to?: any;
  }>;
  apiSurface: "responses" | "chat";
}

/**
 * Compute effective parameters for OpenAI models used by DataQuilt's deterministic enrichment task.
 * Current defaults:
 * - Reasoning models: drop classic sampling; prefer effort=medium; do not pass temperature.
 * - Non-reasoning models: use temperature=0 for determinism; clamp tokens; no JSON enforcement.
 */
export function computeOpenAIEffectiveParams(
  modelId: string,
  requested: RequestedLLMOptions,
): EffectiveOpenAIParams {
  const caps = getOpenAICapabilities(modelId as OpenAIModelId);
  const sanitizedFields: EffectiveOpenAIParams["sanitizedFields"] = [];

  // Fallback: unknown model → treat as non-reasoning chat model conservatively
  const apiSurface = caps?.apiSurface ?? "chat";
  const supportsTemperature = caps?.supportsTemperature ?? true;
  const supportsReasoningEffort = caps?.supportsReasoningEffort ?? false;
  const defaultMaxTokens = caps?.defaultMaxTokens ?? 2048;

  let temperature: number | undefined = requested.temperature;
  let maxTokens: number | undefined = requested.maxTokens ?? defaultMaxTokens;
  let reasoningEffort: EffectiveOpenAIParams["reasoningEffort"] = supportsReasoningEffort
    ? (caps?.defaultReasoningEffort ?? "medium")
    : undefined;

  if (apiSurface === "responses") {
    // Reasoning path: drop temperature entirely
    if (typeof temperature === "number") {
      sanitizedFields.push({
        field: "temperature",
        action: "dropped",
        reason: "unsupported on reasoning/Responses models",
        from: temperature,
      });
    }
    temperature = undefined;
    // No clamping: respect requested or model default maximums
  } else {
    // Chat path: force deterministic default for enrichment
    const original = temperature;
    const desired = 0;
    if (!supportsTemperature && typeof original === "number") {
      sanitizedFields.push({
        field: "temperature",
        action: "dropped",
        reason: "model ignores temperature",
        from: original,
      });
      temperature = undefined;
    } else if (supportsTemperature) {
      if (original !== desired) {
        sanitizedFields.push({
          field: "temperature",
          action: "overridden",
          reason: "deterministic_json default",
          from: original,
          to: desired,
        });
      }
      temperature = desired;
    }
    // No clamping: respect requested or model default maximums
  }

  return { temperature, maxTokens, reasoningEffort, sanitizedFields, apiSurface };
}

// -----------------------------
// Perplexity capabilities
// -----------------------------

export type PerplexityModelId = "sonar" | "sonar-pro" | "sonar-reasoning" | "sonar-reasoning-pro";

export interface PerplexityCapabilities {
  apiSurface: "chat";
  supportsTemperature: boolean;
  defaultMaxTokens: number;
}

const PERPLEXITY_CAPABILITY_MAP: Record<PerplexityModelId, PerplexityCapabilities> = {
  "sonar": { apiSurface: "chat", supportsTemperature: true, defaultMaxTokens: 4096 },
  "sonar-pro": { apiSurface: "chat", supportsTemperature: true, defaultMaxTokens: 4096 },
  "sonar-reasoning": { apiSurface: "chat", supportsTemperature: true, defaultMaxTokens: 4096 },
  "sonar-reasoning-pro": { apiSurface: "chat", supportsTemperature: true, defaultMaxTokens: 4096 },
};

export interface EffectivePerplexityParams {
  temperature?: number;
  maxTokens?: number;
  sanitizedFields: Array<{
    field: string;
    action: "dropped" | "overridden";
    reason: string;
    from?: any;
    to?: any;
  }>;
  apiSurface: "chat";
  searchMode?: "web" | "academic";
}

export function computePerplexityEffectiveParams(
  modelId: string,
  requested: RequestedLLMOptions,
): EffectivePerplexityParams {
  const caps = (PERPLEXITY_CAPABILITY_MAP as any)[modelId] as PerplexityCapabilities | undefined;
  const sanitizedFields: EffectivePerplexityParams["sanitizedFields"] = [];
  const defaultMaxTokens = caps?.defaultMaxTokens ?? 512;

  let temperature = requested.temperature;
  let maxTokens: number | undefined = requested.maxTokens ?? defaultMaxTokens;

  // Deterministic enrichment default
  const desiredTemp = 0;
  if ((caps?.supportsTemperature ?? true) && temperature !== desiredTemp) {
    sanitizedFields.push({
      field: "temperature",
      action: "overridden",
      reason: "deterministic_json default",
      from: temperature,
      to: desiredTemp,
    });
    temperature = desiredTemp;
  }

  // No clamping: respect requested or model default maximums

  const searchMode: EffectivePerplexityParams["searchMode"] = "web";
  return { temperature, maxTokens, sanitizedFields, apiSurface: "chat", searchMode };
}

// -----------------------------
// Gemini capabilities
// -----------------------------

export type GeminiModelId =
  | "gemini-2.5-pro"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-2.0-flash";

export interface GeminiCapabilities {
  apiSurface: "chat";
  supportsTemperature: boolean;
  defaultMaxOutputTokens: number;
}

const GEMINI_CAPABILITY_MAP: Record<GeminiModelId, GeminiCapabilities> = {
  "gemini-2.5-pro": { apiSurface: "chat", supportsTemperature: true, defaultMaxOutputTokens: 10000 },
  "gemini-2.5-flash": {
    apiSurface: "chat",
    supportsTemperature: true,
    defaultMaxOutputTokens: 2500,
  },
  "gemini-2.5-flash-lite": {
    apiSurface: "chat",
    supportsTemperature: true,
    defaultMaxOutputTokens: 400,
  },
  "gemini-2.0-flash": {
    apiSurface: "chat",
    supportsTemperature: true,
    defaultMaxOutputTokens: 2500,
  },
};

export interface EffectiveGeminiParams {
  temperature?: number;
  maxOutputTokens?: number;
  sanitizedFields: Array<{
    field: string;
    action: "dropped" | "overridden";
    reason: string;
    from?: any;
    to?: any;
  }>;
  apiSurface: "chat";
}

export function computeGeminiEffectiveParams(
  modelId: string,
  requested: RequestedLLMOptions,
): EffectiveGeminiParams {
  const caps = (GEMINI_CAPABILITY_MAP as any)[modelId] as GeminiCapabilities | undefined;
  const sanitizedFields: EffectiveGeminiParams["sanitizedFields"] = [];
  const defaultMax = caps?.defaultMaxOutputTokens ?? 512;

  let temperature = requested.temperature;
  let maxOutputTokens: number | undefined = requested.maxTokens ?? defaultMax;

  // Deterministic enrichment default
  const desiredTemp = 0;
  if ((caps?.supportsTemperature ?? true) && temperature !== desiredTemp) {
    sanitizedFields.push({
      field: "temperature",
      action: "overridden",
      reason: "deterministic_json default",
      from: temperature,
      to: desiredTemp,
    });
    temperature = desiredTemp;
  }

  // No clamping: respect requested or model default maximums

  return { temperature, maxOutputTokens, sanitizedFields, apiSurface: "chat" };
}

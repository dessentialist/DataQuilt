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
 *
 * Verified against OpenAI API docs on 2026-05-17.
 *  - GPT-5.5 / 5.5-pro / 5.4-mini / 5.4-nano / 5 / 5-mini: reasoning models on the Responses API; no classic sampling.
 *  - GPT-4o / 4o-mini / 4.1 / 4.1-mini: Chat Completions surface; accept temperature and other classic params.
 */

export type OpenAIModelId =
  | "gpt-5.5"
  | "gpt-5.5-pro"
  | "gpt-5.4-mini"
  | "gpt-5.4-nano"
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
  "gpt-5.5": {
    apiSurface: "responses",
    supportsTemperature: false,
    supportsTopP: false,
    supportsPenalties: false,
    supportsReasoningEffort: true,
    defaultReasoningEffort: "high",
    defaultMaxTokens: 128000,
  },
  "gpt-5.5-pro": {
    // GPT-5.5 Pro is Responses-API-only and handles tougher problems with more compute.
    apiSurface: "responses",
    supportsTemperature: false,
    supportsTopP: false,
    supportsPenalties: false,
    supportsReasoningEffort: true,
    defaultReasoningEffort: "high",
    defaultMaxTokens: 128000,
  },
  "gpt-5.4-mini": {
    apiSurface: "responses",
    supportsTemperature: false,
    supportsTopP: false,
    supportsPenalties: false,
    supportsReasoningEffort: true,
    defaultReasoningEffort: "medium",
    defaultMaxTokens: 128000,
  },
  "gpt-5.4-nano": {
    // Nano is optimized for high-volume simple tasks; reasoning support is minimal.
    apiSurface: "chat",
    supportsTemperature: true,
    supportsTopP: true,
    supportsPenalties: true,
    supportsReasoningEffort: false,
    defaultMaxTokens: 32768,
  },
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

export type PerplexityModelId = "sonar" | "sonar-pro" | "sonar-reasoning-pro";

export interface PerplexityCapabilities {
  apiSurface: "chat";
  supportsTemperature: boolean;
  defaultMaxTokens: number;
}

const PERPLEXITY_CAPABILITY_MAP: Record<PerplexityModelId, PerplexityCapabilities> = {
  "sonar": { apiSurface: "chat", supportsTemperature: true, defaultMaxTokens: 4096 },
  "sonar-pro": { apiSurface: "chat", supportsTemperature: true, defaultMaxTokens: 4096 },
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
  | "gemini-3.1-pro-preview"
  | "gemini-3-flash-preview"
  | "gemini-3.1-flash-lite-preview"
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
  // Gemini 3.x — current generation
  "gemini-3.1-pro-preview": { apiSurface: "chat", supportsTemperature: true, defaultMaxOutputTokens: 10000 },
  "gemini-3-flash-preview": { apiSurface: "chat", supportsTemperature: true, defaultMaxOutputTokens: 2500 },
  "gemini-3.1-flash-lite-preview": { apiSurface: "chat", supportsTemperature: true, defaultMaxOutputTokens: 400 },
  // Gemini 2.5 — deprecated, kept for backward compat
  "gemini-2.5-pro": { apiSurface: "chat", supportsTemperature: true, defaultMaxOutputTokens: 10000 },
  "gemini-2.5-flash": { apiSurface: "chat", supportsTemperature: true, defaultMaxOutputTokens: 2500 },
  "gemini-2.5-flash-lite": { apiSurface: "chat", supportsTemperature: true, defaultMaxOutputTokens: 400 },
  "gemini-2.0-flash": { apiSurface: "chat", supportsTemperature: true, defaultMaxOutputTokens: 2500 },
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

// -----------------------------
// DeepSeek capabilities
// -----------------------------
// DeepSeek V4 (released April 2026) supports a request-level `thinking` toggle for both Flash and Pro.
// The legacy deepseek-chat / deepseek-reasoner aliases are EOL 2026-07-24 and have been removed from the registry.

export type DeepSeekModelId = "deepseek-v4-flash" | "deepseek-v4-pro";

export interface DeepSeekCapabilities {
  apiSurface: "chat";
  supportsTemperature: boolean;
  supportsThinking: boolean; // V4 toggles thinking via a request param, not the model ID
  defaultMaxTokens: number;
}

const DEEPSEEK_CAPABILITY_MAP: Record<DeepSeekModelId, DeepSeekCapabilities> = {
  "deepseek-v4-flash": { apiSurface: "chat", supportsTemperature: true, supportsThinking: true, defaultMaxTokens: 4096 },
  "deepseek-v4-pro": { apiSurface: "chat", supportsTemperature: true, supportsThinking: true, defaultMaxTokens: 4096 },
};

export interface EffectiveDeepSeekParams {
  temperature?: number;
  maxTokens?: number;
  thinking: boolean;
  sanitizedFields: Array<{
    field: string;
    action: "dropped" | "overridden";
    reason: string;
    from?: any;
    to?: any;
  }>;
  apiSurface: "chat";
}

export function computeDeepSeekEffectiveParams(
  modelId: string,
  requested: RequestedLLMOptions & { thinking?: boolean },
): EffectiveDeepSeekParams {
  const caps = (DEEPSEEK_CAPABILITY_MAP as any)[modelId] as DeepSeekCapabilities | undefined;
  const sanitizedFields: EffectiveDeepSeekParams["sanitizedFields"] = [];
  const defaultMaxTokens = caps?.defaultMaxTokens ?? 4096;

  let temperature = requested.temperature;
  let maxTokens: number | undefined = requested.maxTokens ?? defaultMaxTokens;
  const thinking = caps?.supportsThinking ? Boolean(requested.thinking) : false;

  // Deterministic enrichment default when thinking is OFF; thinking mode often ignores temperature.
  const desiredTemp = 0;
  if (!thinking && (caps?.supportsTemperature ?? true) && temperature !== desiredTemp) {
    sanitizedFields.push({
      field: "temperature",
      action: "overridden",
      reason: "deterministic_json default",
      from: temperature,
      to: desiredTemp,
    });
    temperature = desiredTemp;
  } else if (thinking && typeof temperature === "number") {
    sanitizedFields.push({
      field: "temperature",
      action: "dropped",
      reason: "DeepSeek V4 thinking mode ignores temperature",
      from: temperature,
    });
    temperature = undefined;
  }

  return { temperature, maxTokens, thinking, sanitizedFields, apiSurface: "chat" };
}

export function getDeepSeekCapabilities(modelId: string): DeepSeekCapabilities | null {
  return (DEEPSEEK_CAPABILITY_MAP as any)[modelId] || null;
}

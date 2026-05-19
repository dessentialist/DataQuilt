export type Provider = "openai" | "gemini" | "perplexity" | "deepseek" | "anthropic";

export interface ModelEntry {
  id: string; // provider-specific model ID used in API calls
  displayName: string; // human-friendly name for UI
  chatCapable: boolean; // true for chat/completions workflows
  reasoningCapable?: boolean; // true if model includes reasoning features but still supports chat
  deprecated?: boolean; // true if the provider has formally deprecated or end-of-life'd the model; keep listed for backward compat but UI may group under "Legacy"
  notes?: string;
}

/**
 * Curated allowlist of supported models per provider.
 * Show displayName to users; use id in API calls and validation.
 * Verified against provider documentation on 2026-05-17.
 */
export const MODEL_REGISTRY: Record<Provider, ModelEntry[]> = {
  openai: [
    // GPT-5.5 line — current frontier (released April 2026)
    { id: "gpt-5.5", displayName: "GPT-5.5", chatCapable: true, reasoningCapable: true },
    { id: "gpt-5.5-pro", displayName: "GPT-5.5 Pro", chatCapable: true, reasoningCapable: true, notes: "Responses API only; for tougher problems benefiting from more compute" },
    // GPT-5.4 mini/nano line — efficient variants
    { id: "gpt-5.4-mini", displayName: "GPT-5.4-mini", chatCapable: true, reasoningCapable: true },
    { id: "gpt-5.4-nano", displayName: "GPT-5.4-nano", chatCapable: true, reasoningCapable: false, notes: "Optimized for simple high-volume tasks" },
    // GPT-5 base
    { id: "gpt-5", displayName: "GPT-5", chatCapable: true, reasoningCapable: true },
    { id: "gpt-5-mini", displayName: "GPT-5-mini", chatCapable: true, reasoningCapable: true },
    // GPT-4 line (still supported, kept for cost-sensitive workloads)
    { id: "gpt-4o", displayName: "GPT-4o", chatCapable: true, reasoningCapable: false },
    { id: "gpt-4o-mini", displayName: "GPT-4o-mini", chatCapable: true, reasoningCapable: false },
    { id: "gpt-4.1", displayName: "GPT-4.1", chatCapable: true, reasoningCapable: false },
    { id: "gpt-4.1-mini", displayName: "GPT-4.1-mini", chatCapable: true, reasoningCapable: false },
  ],
  gemini: [
    // Gemini 3.x — current generation (Preview); promoted to primary, default in LLM_MODEL_CONFIGS
    { id: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro (Preview)", chatCapable: true, reasoningCapable: true, notes: "Preview — may change without notice" },
    { id: "gemini-3-flash-preview", displayName: "Gemini 3 Flash (Preview)", chatCapable: true, reasoningCapable: true, notes: "Preview — may change without notice" },
    { id: "gemini-3.1-flash-lite-preview", displayName: "Gemini 3.1 Flash-Lite (Preview)", chatCapable: true, reasoningCapable: false, notes: "Preview — most cost-efficient" },
    // Gemini 2.5 — kept available but marked deprecated
    { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", chatCapable: true, reasoningCapable: true, deprecated: true, notes: "Superseded by Gemini 3.1 Pro" },
    { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", chatCapable: true, reasoningCapable: true, deprecated: true, notes: "Superseded by Gemini 3 Flash" },
    { id: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash-Lite", chatCapable: true, reasoningCapable: false, deprecated: true, notes: "Superseded by Gemini 3.1 Flash-Lite" },
    { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", chatCapable: true, reasoningCapable: false, deprecated: true, notes: "Legacy" },
  ],
  perplexity: [
    { id: "sonar", displayName: "Sonar", chatCapable: true, reasoningCapable: false },
    { id: "sonar-pro", displayName: "Sonar Pro", chatCapable: true, reasoningCapable: false },
    { id: "sonar-reasoning-pro", displayName: "Sonar Reasoning Pro", chatCapable: true, reasoningCapable: true },
    // sonar-reasoning (non-pro) appears retired from the public lineup as of 2026 — removed.
    // sonar-deep-research is available but carries a $14–$22 per 1k-query premium; gated behind an explicit opt-in (not yet exposed).
  ],
  deepseek: [
    // DeepSeek V4 (released April 2026). Both support 1M context and dual thinking/non-thinking modes via request param.
    // Legacy deepseek-chat / deepseek-reasoner aliases discontinue 2026-07-24 and have been removed.
    { id: "deepseek-v4-flash", displayName: "DeepSeek V4 Flash", chatCapable: true, reasoningCapable: true, notes: "Fast, efficient (284B total / 13B active params); thinking toggles via request param" },
    { id: "deepseek-v4-pro", displayName: "DeepSeek V4 Pro", chatCapable: true, reasoningCapable: true, notes: "Top-tier (1.6T total / 49B active params); thinking toggles via request param" },
  ],
  anthropic: [
    // Claude 4.x — current generation (April–May 2026)
    { id: "claude-opus-4-7", displayName: "Claude Opus 4.7", chatCapable: true, reasoningCapable: true, notes: "Flagship; extended thinking supported" },
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", chatCapable: true, reasoningCapable: true, notes: "Balanced default; 1M context, extended thinking supported" },
    { id: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5", chatCapable: true, reasoningCapable: true, notes: "Fastest, most cost-effective" },
    // Claude 4.5 — previous generation, still supported
    { id: "claude-sonnet-4-5-20250929", displayName: "Claude Sonnet 4.5", chatCapable: true, reasoningCapable: true, deprecated: true, notes: "Superseded by Sonnet 4.6" },
    // Claude 3.5 — older but not yet formally deprecated by Anthropic at time of update; kept as legacy
    { id: "claude-3-5-sonnet-latest", displayName: "Claude 3.5 Sonnet", chatCapable: true, reasoningCapable: false, deprecated: true, notes: "Legacy — verify against Anthropic deprecation page before relying on this" },
    { id: "claude-3-5-haiku-latest", displayName: "Claude 3.5 Haiku", chatCapable: true, reasoningCapable: false, deprecated: true, notes: "Legacy — verify against Anthropic deprecation page before relying on this" },
    // Claude 3 base models (opus/sonnet/haiku 20240229/20240307) were dropped — formally deprecated by Anthropic.
  ],
};

export function getModelsForProvider(provider: Provider): ModelEntry[] {
  return MODEL_REGISTRY[provider] || [];
}

export function getActiveModelsForProvider(provider: Provider): ModelEntry[] {
  return getModelsForProvider(provider).filter((m) => !m.deprecated);
}

export function isAllowedModelId(provider: Provider, modelId: string | undefined | null): boolean {
  if (!modelId) return false;
  return getModelsForProvider(provider).some((m) => m.id === modelId);
}

export function getModelDisplayName(provider: Provider, modelId: string | undefined | null): string {
  const entry = getModelsForProvider(provider).find((m) => m.id === modelId);
  return entry ? entry.displayName : modelId || "Unknown Model";
}

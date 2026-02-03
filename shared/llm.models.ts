export type Provider = "openai" | "gemini" | "perplexity" | "deepseek" | "anthropic";

export interface ModelEntry {
  id: string; // provider-specific model ID used in API calls
  displayName: string; // human-friendly name for UI
  chatCapable: boolean; // true for chat/completions workflows
  reasoningCapable?: boolean; // true if model includes reasoning features but still supports chat
  notes?: string;
}

/**
 * Curated allowlist of supported models per provider.
 * Show displayName to users; use id in API calls and validation.
 */
export const MODEL_REGISTRY: Record<Provider, ModelEntry[]> = {
  openai: [
    { id: "gpt-5", displayName: "GPT-5", chatCapable: true, reasoningCapable: true },
    { id: "gpt-5-mini", displayName: "GPT-5-mini", chatCapable: true, reasoningCapable: true },
    { id: "gpt-4o", displayName: "GPT-4o", chatCapable: true, reasoningCapable: true },
    { id: "gpt-4o-mini", displayName: "GPT-4o-mini", chatCapable: true, reasoningCapable: false },
    { id: "gpt-4.1", displayName: "GPT-4.1", chatCapable: true, reasoningCapable: true },
    { id: "gpt-4.1-mini", displayName: "GPT-4.1-mini", chatCapable: true, reasoningCapable: true },
  ],
  gemini: [
    // Gemini 2.5 (thinking on by default for Pro/Flash)
    { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", chatCapable: true, reasoningCapable: true, notes: "Thinking on by default" },
    { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", chatCapable: true, reasoningCapable: true },
    { id: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash-Lite", chatCapable: true, reasoningCapable: false },
    // Optional legacy entry kept for compatibility
    { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", chatCapable: true, reasoningCapable: false, notes: "Legacy/compatibility" },
  ],
  perplexity: [
    { id: "sonar", displayName: "Sonar", chatCapable: true, reasoningCapable: false },
    { id: "sonar-pro", displayName: "Sonar Pro", chatCapable: true, reasoningCapable: false },
    { id: "sonar-reasoning", displayName: "Sonar Reasoning", chatCapable: true, reasoningCapable: true },
    { id: "sonar-reasoning-pro", displayName: "Sonar Reasoning Pro", chatCapable: true, reasoningCapable: true },
  ],
  deepseek: [
    // DeepSeek uses OpenAI-compatible API surface. V3.1: chat vs reasoner
    { id: "deepseek-chat", displayName: "DeepSeek Chat (V3.1)", chatCapable: true, reasoningCapable: false },
    { id: "deepseek-reasoner", displayName: "DeepSeek Reasoner (V3.1)", chatCapable: true, reasoningCapable: true, notes: "Thinking mode" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-5-20250929", displayName: "Claude Sonnet 4.5", chatCapable: true, reasoningCapable: true },
    { id: "claude-3-5-sonnet-latest", displayName: "Claude 3.5 Sonnet (Latest)", chatCapable: true, reasoningCapable: true },
    { id: "claude-3-5-haiku-latest", displayName: "Claude 3.5 Haiku (Latest)", chatCapable: true, reasoningCapable: true },
    { id: "claude-3-opus-20240229", displayName: "Claude 3 Opus", chatCapable: true, reasoningCapable: true },
    { id: "claude-3-sonnet-20240229", displayName: "Claude 3 Sonnet", chatCapable: true, reasoningCapable: true },
    { id: "claude-3-haiku-20240307", displayName: "Claude 3 Haiku", chatCapable: true, reasoningCapable: false },
  ],
};

export function getModelsForProvider(provider: Provider): ModelEntry[] {
  return MODEL_REGISTRY[provider] || [];
}

export function isAllowedModelId(provider: Provider, modelId: string | undefined | null): boolean {
  if (!modelId) return false;
  return getModelsForProvider(provider).some((m) => m.id === modelId);
}

export function getModelDisplayName(provider: Provider, modelId: string | undefined | null): string {
  const entry = getModelsForProvider(provider).find((m) => m.id === modelId);
  return entry ? entry.displayName : modelId || "Unknown Model";
}



import type { PromptConfig } from "@shared/schema";

// UI-only prompt type used across the client – extends PromptConfig with a stable localId
export type UiPrompt = PromptConfig & { localId: string };

/**
 * Generates a stable, unique local ID for UI prompt rows.
 * Prefer Web Crypto randomUUID when available; fall back to a cute, human-friendly ID.
 */
export function generateLocalId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      const id = (crypto as any).randomUUID();
      console.log("[uiPrompts] Generated uuid localId", id);
      return id;
    }
  } catch (err) {
    console.warn("[uiPrompts] crypto.randomUUID unavailable, using fallback", err);
  }
  const fallback = `sunny-puppy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log("[uiPrompts] Generated fallback localId", fallback);
  return fallback;
}

/**
 * Creates a new, empty UiPrompt with consistent defaults across the app.
 * The modelId is intentionally empty – user must choose an allowed model for the provider.
 */
export function createEmptyUiPrompt(): UiPrompt {
  const prompt: UiPrompt = {
    localId: generateLocalId(),
    promptText: "",
    outputColumnName: "",
    model: "openai",
    modelId: "",
  };
  console.log("[uiPrompts] Created empty UiPrompt", { localId: prompt.localId, model: prompt.model });
  return prompt;
}



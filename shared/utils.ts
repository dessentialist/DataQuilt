/**
 * Substitute {{variable}} in promptText with values from rowData.
 * Includes prior output columns so prompts can chain outputs.
 */
export function substituteVariables(promptText: string, rowData: Record<string, any>): string {
  let processedPrompt = promptText;
  const matches = promptText.match(/\{\{([^}]+)\}\}/g);
  if (matches) {
    for (const match of matches) {
      const variable = match.replace(/[{}]/g, "");
      const value = rowData[variable] ?? "";
      processedPrompt = processedPrompt.replace(match, String(value));
    }
  }
  return processedPrompt;
}

/**
 * Substitute variables in both system and user texts using the same semantics.
 */
export function substituteVariablesInMessages(
  systemText: string | undefined,
  userText: string,
  rowData: Record<string, any>,
): { systemProcessed?: string; userProcessed: string } {
  const userProcessed = substituteVariables(userText, rowData);
  const systemProcessed = typeof systemText === "string" && systemText.length > 0
    ? substituteVariables(systemText, rowData)
    : undefined;
  return { systemProcessed, userProcessed };
}

/**
 * Extract variables using the exact same semantics as substitution: {{variable}}
 * This function is shared so both server and client compute the same set.
 */
export function extractVariables(text: string | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/[{}]/g, ""));
}

/**
 * Compose autocomplete suggestions from CSV headers and any prior output column names.
 * Returns a de-duplicated array, preserving natural order as much as possible.
 */
export function composeAutocompleteSuggestions(
  headers: string[],
  outputColumnNames: string[],
): string[] {
  const set = new Set<string>();
  for (const h of headers) set.add(h);
  for (const o of outputColumnNames) if (o) set.add(o);
  return Array.from(set);
}

/**
 * Build canonical storage paths for artifacts to keep structure consistent.
 */
export const storagePaths = {
  enriched(userId: string, jobId: string) {
    return `enriched/${userId}/${jobId}_enriched.csv`;
  },
  partial(userId: string, jobId: string) {
    return `enriched/${userId}/${jobId}_partial.csv`;
  },
  logs(userId: string, jobId: string) {
    return `logs/${userId}/${jobId}.txt`;
  },
  // Legacy logs path for lazy back-compat
  legacyLogs(userId: string, jobId: string) {
    return `enriched/${userId}/${jobId}_logs.txt`;
  },
  /** Control file for job options (no DB changes). Absence implies defaults (skip=false). */
  controls(userId: string, jobId: string) {
    return `controls/${userId}/${jobId}.json`;
  },
};

/**
 * Determine if a cell should be considered "filled" for skip logic.
 * Rules:
 * - Empty if: null/undefined, empty/whitespace string, error markers (LLM_ERROR, ROW_ERROR), or NA variants (NA, N/A), all case-insensitive.
 * - Filled if: any non-string non-null value, or any non-empty string not matching the above markers.
 */
export function isCellFilledForSkip(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "string") return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  const upper = trimmed.toUpperCase();
  if (upper === "LLM_ERROR" || upper === "ROW_ERROR") return false;
  // Treat common Excel error literals as empty as well
  const excelErrors = new Set([
    "#N/A",
    "#N/A!",
    "NA",
    "N/A",
    "#NA",
    "#VALUE!",
    "#REF!",
    "#DIV/0!",
    "#NUM!",
    "#NAME?",
    "#NULL!",
  ]);
  if (excelErrors.has(upper)) return false;
  return true;
}

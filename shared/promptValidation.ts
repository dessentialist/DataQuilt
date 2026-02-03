import type { PromptConfig } from "./schema";
import { logDebug } from "./logger";

export type PromptValidationIssueType =
  | "unknownVariable"
  | "futureReference"
  | "duplicateOutputColumnName"
  | "outputCollidesWithInputHeader"
  | "selfReference"
  | "missingField";

export interface PromptValidationIssue {
  type: PromptValidationIssueType;
  promptIndex: number; // 0-based index of the offending prompt
  message: string; // human-friendly description
  details?: Record<string, unknown>; // structured extras (variable name, referencedPromptIndex, etc.)
}

export interface PromptValidationResult {
  ok: boolean;
  issues: PromptValidationIssue[];
}

/**
 * Extracts variables using the same exact semantics as substituteVariables: {{variable}}
 * This is case-sensitive and preserves whitespace exactly as written between braces.
 */
function extractVariables(promptText: string): string[] {
  const matches = promptText.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/[{}]/g, ""));
}

/**
 * Validates a set of prompts against input CSV headers and sequential output dependencies.
 * - Variables must exist in inputHeaders OR be produced by a prior prompt's outputColumnName
 * - References to outputs from future prompts are flagged as futureReference
 * - Duplicate outputColumnName across prompts is flagged
 * - Output column name colliding with an existing CSV header is flagged
 * - Missing fields (promptText/outputColumnName/modelId) are flagged
 */
export function validatePrompts(
  prompts: PromptConfig[],
  inputHeaders: string[],
): PromptValidationResult {
  const issues: PromptValidationIssue[] = [];

  const inputHeaderSet = new Set(inputHeaders || []);
  const outputToIndex = new Map<string, number>();

  // Precompute output indices and detect duplicates
  const seenOutputs = new Map<string, number[]>();
  prompts.forEach((p, idx) => {
    const name = p.outputColumnName;
    if (!seenOutputs.has(name)) seenOutputs.set(name, []);
    seenOutputs.get(name)!.push(idx);
    if (!outputToIndex.has(name)) outputToIndex.set(name, idx);
  });

  // Duplicate outputs
  for (const [name, idxs] of seenOutputs.entries()) {
    if (!name) continue;
    if (idxs.length > 1) {
      for (const i of idxs) {
        issues.push({
          type: "duplicateOutputColumnName",
          promptIndex: i,
          message: `Duplicate output column name: ${name}`,
          details: { outputColumnName: name, duplicateIndices: idxs },
        });
      }
    }
  }

  // Output collides with input header
  prompts.forEach((p, idx) => {
    if (p.outputColumnName && inputHeaderSet.has(p.outputColumnName)) {
      issues.push({
        type: "outputCollidesWithInputHeader",
        promptIndex: idx,
        message: `Output column '${p.outputColumnName}' collides with an existing input header`,
        details: { outputColumnName: p.outputColumnName },
      });
    }
  });

  // Missing fields quick check (client-side courtesy; server will also validate)
  prompts.forEach((p, idx) => {
    if (!p.promptText || !p.outputColumnName || !p.modelId) {
      const missing: string[] = [];
      if (!p.promptText) missing.push("promptText");
      if (!p.outputColumnName) missing.push("outputColumnName");
      if (!p.modelId) missing.push("modelId");
      if (missing.length > 0) {
        issues.push({
          type: "missingField",
          promptIndex: idx,
          message: `Missing required field(s): ${missing.join(", ")}`,
          details: { missing },
        });
      }
    }
  });

  // Sequential dependency validation (variables may appear in systemText and/or promptText)
  const producedSoFar = new Set<string>();
  prompts.forEach((p, idx) => {
    // Build allowed variables for this prompt
    const allowed = new Set<string>([...inputHeaderSet, ...producedSoFar]);

    const userVars = extractVariables(p.promptText || "");
    const systemVars = extractVariables((p as any).systemText || "");
    const allVars = [...userVars, ...systemVars];
    for (const variable of allVars) {
      // Explicitly disallow referencing the same column as this prompt's own output
      if (p.outputColumnName && variable === p.outputColumnName) {
        issues.push({
          type: "selfReference",
          promptIndex: idx,
          message: `Prompt references its own output column '{{${variable}}}', which is not allowed.`,
          details: { variable, outputColumnName: p.outputColumnName },
        });
        continue;
      }

      if (allowed.has(variable)) continue;
      // If it is produced by some prompt, check if it's in the future
      const producingIndex = outputToIndex.get(variable);
      if (typeof producingIndex === "number") {
        if (producingIndex > idx) {
          issues.push({
            type: "futureReference",
            promptIndex: idx,
            message: `Variable '{{${variable}}}' references output produced by a future prompt at index ${producingIndex + 1}`,
            details: { variable, referencedPromptIndex: producingIndex },
          });
        } else {
          // Produced by a prior or same index; same index should be impossible unless user references its own output
          // Not flagged (self-reference would remain unresolved but mirrors current behavior)
        }
      } else {
        // Not in inputs nor any outputs
        issues.push({
          type: "unknownVariable",
          promptIndex: idx,
          message: `Unknown variable '{{${variable}}}' – not found in input headers or prior outputs`,
          details: { variable },
        });
      }
    }

    // After validating, mark this prompt's output as produced for subsequent prompts
    if (p.outputColumnName) producedSoFar.add(p.outputColumnName);
  });

  const result: PromptValidationResult = { ok: issues.length === 0, issues };
  logDebug("prompt_validation_result", { ok: result.ok, issueCount: issues.length });
  return result;
}



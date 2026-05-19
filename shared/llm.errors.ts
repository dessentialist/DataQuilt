/**
 * LLM Error Categorization Service
 *
 * Centralizes error classification for LLM provider errors (OpenAI, Gemini, Perplexity, DeepSeek, Anthropic).
 * Provides structured error information including category, retryability, user-friendly messages,
 * and technical details for debugging and telemetry.
 *
 * Usage:
 *   const categorized = categorizeLLMError(error, provider);
 *   if (categorized.retryable) { // retry logic }
 *   console.error(categorized.userMessage, { category: categorized.category, ...categorized.metadata });
 */

import type { SupportedModel } from "./llm";

/**
 * Error categories for LLM provider errors
 */
export type LLMErrorCategory =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "API_ERROR"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "TOKEN_LIMIT"
  | "UNSUPPORTED_PARAMETER"
  | "QUOTA_EXCEEDED"
  | "CONTENT_FILTERED"
  | "UNKNOWN";

/**
 * Structured error information from categorization
 */
export interface CategorizedLLMError {
  /**
   * Error category for classification and analytics
   */
  category: LLMErrorCategory;

  /**
   * Whether this error is retryable (transient failures)
   */
  retryable: boolean;

  /**
   * User-friendly error message suitable for display in UI
   */
  userMessage: string;

  /**
   * Technical error message for logging and debugging
   */
  technicalMessage: string;

  /**
   * Provider-specific metadata extracted from the error
   */
  metadata: {
    provider?: SupportedModel;
    statusCode?: number;
    errorCode?: string; // Node.js error codes like ECONNRESET, or provider error codes
    retryAfter?: number; // seconds
    originalMessage?: string;
    errorName?: string;
    finishReason?: string; // Response finish_reason (e.g., "content_filter", "error")
  };
}

/**
 * Categorize an LLM provider error into a structured format
 *
 * @param error - The error object from LangChain or HTTP client
 * @param provider - The LLM provider (openai, gemini, perplexity, deepseek, anthropic)
 * @returns Categorized error with category, retryability, and messages
 *
 * @example
 * try {
 *   await llmService.processMessages(...);
 * } catch (error) {
 *   const categorized = categorizeLLMError(error, "openai");
 *   if (categorized.retryable) {
 *     // Retry logic
 *   }
 *   console.error(categorized.userMessage, categorized.metadata);
 * }
 */
export function categorizeLLMError(
  error: unknown,
  provider: SupportedModel = "openai",
): CategorizedLLMError {
  // Extract error properties safely
  const errorObj = error as any;
  const statusCode = typeof errorObj?.status === "number" ? errorObj.status : undefined;
  const errorName = errorObj?.name || errorObj?.constructor?.name;
  const errorCode = errorObj?.code; // Node.js error codes
  const errorMessage = errorObj?.message || String(error);
  const messageText = errorMessage.toLowerCase();
  
  // Check for response metadata error indicators (HTTP 200 but error in finish_reason)
  const finishReason = errorObj?.finishReason;
  const hasErrorFinishReason = finishReason && 
    ["content_filter", "error", "safety", "safety_ratings"].includes(String(finishReason).toLowerCase());

  // Extract retry-after header if present (for rate limits)
  const retryAfter = errorObj?.headers?.["retry-after"]
    ? parseInt(errorObj.headers["retry-after"], 10)
    : errorObj?.retryAfter
      ? parseInt(String(errorObj.retryAfter), 10)
      : undefined;

  // Build base metadata
  const metadata: CategorizedLLMError["metadata"] = {
    provider,
    statusCode,
    errorCode,
    originalMessage: errorMessage,
    errorName,
    retryAfter,
    finishReason: finishReason ? String(finishReason) : undefined,
  };

  // Categorize based on error characteristics (order matters - most specific first)

  // 1. Timeout errors (AbortError from AbortController or timeout messages)
  if (
    errorName === "AbortError" ||
    messageText.includes("timeout") ||
    messageText.includes("timed out") ||
    messageText.includes("aborted")
  ) {
    return {
      category: "TIMEOUT",
      retryable: true,
      userMessage: "The request timed out. This may be due to a slow network or the model taking too long to respond.",
      technicalMessage: `Timeout error: ${errorMessage}`,
      metadata,
    };
  }

  // 2. Rate limit errors (HTTP 429)
  if (statusCode === 429 || messageText.includes("rate limit") || messageText.includes("too many requests")) {
    const retryHint = retryAfter ? ` Please try again in ${retryAfter} seconds.` : "";
    return {
      category: "RATE_LIMIT",
      retryable: true,
      userMessage: `Rate limit exceeded. The API is temporarily limiting requests.${retryHint}`,
      technicalMessage: `Rate limit error (429): ${errorMessage}`,
      metadata: { ...metadata, retryAfter },
    };
  }

  // 3. Authentication errors (HTTP 401, 403, or organization/verification issues)
  // Check most specific error types first, then more general ones
  
  // 3a. Organization verification errors (most specific - check first)
  if (
    messageText.includes("organization must be verified") ||
    messageText.includes("verify organization") ||
    (statusCode === 404 && (messageText.includes("organization") || messageText.includes("verified") || messageText.includes("verification"))) ||
    (statusCode === 403 && (messageText.includes("organization") || messageText.includes("verified") || messageText.includes("verification")))
  ) {
    return {
      category: "AUTH_ERROR",
      retryable: false,
      userMessage: "Your organization must be verified to use this model. Please verify your organization through your account in the LLM provider (OpenAI, Gemini, Perplexity, DeepSeek, Anthropic).",
      technicalMessage: `Organization verification error (${statusCode || 403}): ${errorMessage}`,
      metadata,
    };
  }

  // 3b. Invalid API key errors (explicit invalid key messages)
  if (
    messageText.includes("invalid api key") ||
    messageText.includes("invalid api-key") ||
    messageText.includes("api key is invalid") ||
    messageText.includes("api key invalid")
  ) {
    return {
      category: "AUTH_ERROR",
      retryable: false,
      userMessage: "Your API key is invalid. Please check your API key in [Settings](/settings) and ensure it's correct.",
      technicalMessage: `Invalid API key error (${statusCode || 401}): ${errorMessage}`,
      metadata,
    };
  }

  // 3c. API key errors (general API key issues)
  if (
    messageText.includes("api key") ||
    messageText.includes("api-key") ||
    messageText.includes("apikey")
  ) {
    return {
      category: "AUTH_ERROR",
      retryable: false,
      userMessage: "There's an issue with your API key. Please check your API key in [Settings](/settings). The key may be invalid, expired, or missing required permissions.",
      technicalMessage: `API key error (${statusCode || 401}): ${errorMessage}`,
      metadata,
    };
  }

  // 3d. HTTP 401 Unauthorized errors
  if (statusCode === 401) {
    return {
      category: "AUTH_ERROR",
      retryable: false,
      userMessage: "Authentication failed. Please check your API key in [Settings](/settings). The key may be invalid, expired, or revoked.",
      technicalMessage: `Unauthorized error (401): ${errorMessage}`,
      metadata,
    };
  }

  // 3e. Unauthorized errors (from message text)
  if (messageText.includes("unauthorized")) {
    return {
      category: "AUTH_ERROR",
      retryable: false,
      userMessage: "You are not authorized to access this resource. Please check your API key in [Settings](/settings) and ensure it has the required permissions.",
      technicalMessage: `Unauthorized error (${statusCode || 401}): ${errorMessage}`,
      metadata,
    };
  }

  // 3f. Generic authentication errors (catch-all for auth-related messages)
  if (messageText.includes("authentication") || messageText.includes("authenticate")) {
    return {
      category: "AUTH_ERROR",
      retryable: false,
      userMessage: "Authentication failed. Please check your API key in [Settings](/settings) and verify your account credentials.",
      technicalMessage: `Authentication error (${statusCode || 401}): ${errorMessage}`,
      metadata,
    };
  }

  // 4. Quota/billing errors (HTTP 402, 403 with quota context)
  if (
    statusCode === 402 ||
    (statusCode === 403 && (messageText.includes("quota") || messageText.includes("billing") || messageText.includes("payment"))) ||
    messageText.includes("insufficient quota") ||
    messageText.includes("billing")
  ) {
    return {
      category: "QUOTA_EXCEEDED",
      retryable: false,
      userMessage: "API quota exceeded or billing issue. Please check your account billing status.",
      technicalMessage: `Quota/billing error: ${errorMessage}`,
      metadata,
    };
  }

  // 5. Content filtering (provider-specific safety blocks)
  // Check finish_reason first (HTTP 200 with content_filter finish_reason)
  if (
    hasErrorFinishReason ||
    messageText.includes("safety") ||
    messageText.includes("content filter") ||
    messageText.includes("blocked") ||
    messageText.includes("harmful") ||
    (statusCode === 400 && messageText.includes("safety"))
  ) {
    return {
      category: "CONTENT_FILTERED",
      retryable: false,
      userMessage: "Content was filtered by the provider's safety system. Try rephrasing your prompt.",
      technicalMessage: `Content filtered: ${errorMessage}`,
      metadata,
    };
  }

  // 6. Token limit errors
  if (
    messageText.includes("max tokens") ||
    messageText.includes("maximum tokens") ||
    messageText.includes("too many tokens") ||
    messageText.includes("exceeds") && messageText.includes("token") ||
    messageText.includes("token limit") ||
    (statusCode === 400 && messageText.includes("token"))
  ) {
    return {
      category: "TOKEN_LIMIT",
      retryable: true, // Can retry with reduced maxTokens
      userMessage: "Token limit exceeded. The prompt or response is too long. Try shortening your prompt or reducing max tokens.",
      technicalMessage: `Token limit error: ${errorMessage}`,
      metadata,
    };
  }

  // 7. Unsupported parameter errors (provider-specific)
  if (
    messageText.includes("unsupported") ||
    messageText.includes("does not support") ||
    messageText.includes("only the default") ||
    (statusCode === 400 && messageText.includes("parameter"))
  ) {
    return {
      category: "UNSUPPORTED_PARAMETER",
      retryable: true, // Can retry with sanitized parameters
      userMessage: "Invalid parameter for this model. The request will be retried with adjusted settings.",
      technicalMessage: `Unsupported parameter: ${errorMessage}`,
      metadata,
    };
  }

  // 8. Network errors (connection issues)
  if (
    errorCode === "ECONNRESET" ||
    errorCode === "ETIMEDOUT" ||
    errorCode === "ENOTFOUND" ||
    errorCode === "ECONNREFUSED" ||
    messageText.includes("network") ||
    messageText.includes("connection") ||
    messageText.includes("econnreset") ||
    messageText.includes("etimedout")
  ) {
    return {
      category: "NETWORK_ERROR",
      retryable: true,
      userMessage: "Network connection error. Please check your internet connection and try again.",
      technicalMessage: `Network error (${errorCode || "unknown"}): ${errorMessage}`,
      metadata: { ...metadata, errorCode },
    };
  }

  // 9. Server errors (HTTP 5xx)
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return {
      category: "SERVER_ERROR",
      retryable: true,
      userMessage: "The API service is experiencing issues. Please try again in a moment.",
      technicalMessage: `Server error (${statusCode}): ${errorMessage}`,
      metadata,
    };
  }

  // 10. API errors (HTTP 4xx, excluding already handled)
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return {
      category: "API_ERROR",
      retryable: statusCode === 408 || statusCode === 409, // Timeout or conflict might be retryable
      userMessage: `API error (${statusCode}). Please check your request and try again.`,
      technicalMessage: `API error (${statusCode}): ${errorMessage}`,
      metadata,
    };
  }

  // 11. Unknown/fallback
  return {
    category: "UNKNOWN",
    retryable: false, // Default to non-retryable for unknown errors
    userMessage: `An unexpected error occurred: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? "..." : ""}`,
    technicalMessage: `Unknown error: ${errorMessage}`,
    metadata,
  };
}

/**
 * Get a short error code for telemetry and logging
 *
 * @param error - Categorized error
 * @returns Short error code string (e.g., "LLM_TIMEOUT", "LLM_RATE_LIMIT")
 */
export function getLLMErrorCode(error: CategorizedLLMError): string {
  return `LLM_${error.category}`;
}

/**
 * Determine if an error should trigger exponential backoff retry
 *
 * @param error - Categorized error
 * @returns True if error is retryable and should use backoff
 */
export function shouldRetryWithBackoff(error: CategorizedLLMError): boolean {
  // Rate limits and server errors benefit from backoff
  return (
    error.retryable &&
    (error.category === "RATE_LIMIT" ||
      error.category === "SERVER_ERROR" ||
      error.category === "NETWORK_ERROR" ||
      error.category === "TIMEOUT")
  );
}

/**
 * Get suggested retry delay in milliseconds based on error category
 *
 * @param error - Categorized error
 * @param attempt - Current retry attempt (0-indexed)
 * @returns Suggested delay in milliseconds
 */
export function getRetryDelayMs(error: CategorizedLLMError, attempt: number = 0): number {
  // If error provides retry-after, use it (convert to ms)
  if (error.metadata.retryAfter) {
    return error.metadata.retryAfter * 1000;
  }

  // Exponential backoff for retryable errors
  if (shouldRetryWithBackoff(error)) {
    const baseDelay = 500 * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * 200);
    return baseDelay + jitter;
  }

  // Default: no retry delay
  return 0;
}

/**
 * Determine if an error should trigger automatic job pause
 *
 * Critical errors that require user intervention should pause the job:
 * - AUTH_ERROR: User must fix API key
 * - QUOTA_EXCEEDED: User must resolve billing
 * - CONTENT_FILTERED: User may want to adjust prompt
 *
 * Transient/retryable errors should NOT pause:
 * - RATE_LIMIT, TIMEOUT, NETWORK_ERROR, SERVER_ERROR, etc.
 *
 * @param error - Categorized error
 * @returns True if error should trigger automatic job pause
 */
export function shouldPauseOnError(error: CategorizedLLMError): boolean {
  // Critical errors that require user intervention
  return (
    error.category === "AUTH_ERROR" ||
    error.category === "QUOTA_EXCEEDED" ||
    error.category === "CONTENT_FILTERED"
  );
}

/**
 * Build structured error details for job storage
 * Used when pausing a job due to a critical error
 *
 * @param error - Categorized error
 * @param context - Additional context about where error occurred
 * @returns Structured error details for storage in job.errorDetails
 */
export interface JobErrorDetails {
  category: LLMErrorCategory;
  userMessage: string;
  technicalMessage: string;
  rowNumber: number; // 1-based for user display
  promptIndex: number; // 0-based array index
  promptOutputColumn: string;
  provider: SupportedModel;
  modelId?: string;
  timestamp: string; // ISO 8601
  metadata: CategorizedLLMError["metadata"];
}

export function buildJobErrorDetails(
  error: CategorizedLLMError,
  context: {
    rowNumber: number; // 1-based
    promptIndex: number; // 0-based
    promptOutputColumn: string;
    modelId?: string;
  },
): JobErrorDetails {
  return {
    category: error.category,
    userMessage: error.userMessage,
    technicalMessage: error.technicalMessage,
    rowNumber: context.rowNumber,
    promptIndex: context.promptIndex,
    promptOutputColumn: context.promptOutputColumn,
    provider: error.metadata.provider || "openai",
    modelId: context.modelId || error.metadata.errorCode,
    timestamp: new Date().toISOString(),
    metadata: error.metadata,
  };
}

/**
 * Validate error details structure
 * Used when reading errorDetails from database to ensure structure is valid
 *
 * @param details - Unknown data from database
 * @returns Validated error details or null if invalid
 */
export function validateJobErrorDetails(details: unknown): JobErrorDetails | null {
  if (!details || typeof details !== "object") {
    return null;
  }

  const d = details as any;

  // Check required fields
  if (
    !d.category ||
    !d.userMessage ||
    !d.technicalMessage ||
    typeof d.rowNumber !== "number" ||
    typeof d.promptIndex !== "number" ||
    !d.promptOutputColumn ||
    !d.provider ||
    !d.timestamp
  ) {
    return null;
  }

  // Validate category is known
  const validCategories: LLMErrorCategory[] = [
    "TIMEOUT",
    "RATE_LIMIT",
    "AUTH_ERROR",
    "API_ERROR",
    "SERVER_ERROR",
    "NETWORK_ERROR",
    "TOKEN_LIMIT",
    "UNSUPPORTED_PARAMETER",
    "QUOTA_EXCEEDED",
    "CONTENT_FILTERED",
    "UNKNOWN",
  ];
  if (!validCategories.includes(d.category)) {
    return null;
  }

  return {
    category: d.category,
    userMessage: String(d.userMessage),
    technicalMessage: String(d.technicalMessage),
    rowNumber: Number(d.rowNumber),
    promptIndex: Number(d.promptIndex),
    promptOutputColumn: String(d.promptOutputColumn),
    provider: d.provider,
    modelId: d.modelId ? String(d.modelId) : undefined,
    timestamp: String(d.timestamp),
    metadata: d.metadata || {},
  };
}


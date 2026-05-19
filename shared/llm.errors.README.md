# LLM Error Categorization Service

## Overview

The `shared/llm.errors.ts` module provides centralized error categorization for LLM provider errors. It standardizes error handling across the application, enabling better user messaging, retry logic, and telemetry.

## Architecture

### Error Categories

The service categorizes errors into 11 distinct types:

1. **TIMEOUT** - Request timed out (retryable)
2. **RATE_LIMIT** - API rate limit exceeded (retryable, respects retry-after)
3. **AUTH_ERROR** - Authentication/API key issues or organization verification required (not retryable). Includes: invalid/expired API keys (401), organization verification errors (403/404 with organization keywords), and unauthorized access attempts.
4. **QUOTA_EXCEEDED** - Billing/quota limits (not retryable)
5. **CONTENT_FILTERED** - Safety/content filtering (not retryable)
6. **TOKEN_LIMIT** - Token limit exceeded (retryable with reduced tokens)
7. **UNSUPPORTED_PARAMETER** - Invalid parameter for model (retryable with sanitization)
8. **NETWORK_ERROR** - Connection issues (retryable)
9. **SERVER_ERROR** - Provider server errors (5xx, retryable)
10. **API_ERROR** - Client errors (4xx, conditionally retryable)
11. **UNKNOWN** - Unclassified errors (not retryable by default)

### Categorized Error Structure

```typescript
interface CategorizedLLMError {
  category: LLMErrorCategory;
  retryable: boolean;
  userMessage: string;        // User-friendly message
  technicalMessage: string;    // Technical details for logging
  metadata: {
    provider?: SupportedModel;
    statusCode?: number;
    errorCode?: string;
    retryAfter?: number;       // Seconds (for rate limits)
    originalMessage?: string;
    errorName?: string;
  };
}
```

## Integration

### LLM Service (`shared/llm.ts`)

The LLM service now automatically categorizes errors and includes them in `LLMResponse`:

```typescript
interface LLMResponse {
  content: string;
  success: boolean;
  error?: string;                    // User-friendly message
  categorizedError?: CategorizedLLMError;  // Structured error details
}
```

### Usage Examples

#### Basic Error Handling

```typescript
const response = await llmService.processMessages(...);

if (!response.success) {
  const error = response.categorizedError!;
  
  // Check category
  if (error.category === "RATE_LIMIT") {
    // Handle rate limit with retry-after
    const delay = error.metadata.retryAfter * 1000;
    await sleep(delay);
    // Retry...
  }
  
  // Log structured error
  console.error(getLLMErrorCode(error), {
    category: error.category,
    retryable: error.retryable,
    ...error.metadata,
  });
  
  // Show user-friendly message
  toast.error(error.userMessage);
}
```

#### Retry Logic

```typescript
import { shouldRetryWithBackoff, getRetryDelayMs } from "./llm.errors";

const response = await llmService.processMessages(...);

if (!response.success && response.categorizedError) {
  const error = response.categorizedError;
  
  if (shouldRetryWithBackoff(error)) {
    const delay = getRetryDelayMs(error, attempt);
    await sleep(delay);
    // Retry with exponential backoff
  }
}
```

#### Worker Integration

In `worker/services/job.processor.ts`:

```typescript
const response = await llmService.processMessages(...);

if (!response.success) {
  const error = response.categorizedError!;
  
  // Log with category for analytics
  await this.logMessage(
    job.jobId,
    error.category === "AUTH_ERROR" ? "ERROR" : "WARN",
    `Row ${rowIndex + 1}: ${prompt.model} failed [${error.category}]: ${error.userMessage}`,
  );
  
  // Set error marker (existing behavior)
  workingSet.setOutput(rowIndex, prompt.outputColumnName, "LLM_ERROR");
  
  // Optional: Store categorized error for later analysis
  // Could add to job metadata or logs
}
```

#### Preview Integration

In `server/services/jobs.service.ts`:

```typescript
const response = await llm.processMessages(...);

if (!response.success) {
  const error = response.categorizedError!;
  
  // Use user-friendly message in preview
  enrichedRow[prompt.outputColumnName] = `ERROR: ${error.userMessage}`;
  
  // Include category in prompt details for debugging
  promptDetailsForRow.push({
    ...,
    response: `ERROR: ${error.userMessage}`,
    errorCategory: error.category,  // Optional: add to schema
    errorRetryable: error.retryable,
  });
}
```

## Benefits

### 1. **Consistent Error Handling**
- Single source of truth for error classification
- Same logic used in worker, server, and future client-side code

### 2. **Better User Experience**
- User-friendly messages instead of raw error strings
- Actionable guidance (e.g., "check your API key in Settings")

### 3. **Improved Debugging**
- Structured error metadata for logging
- Category-based filtering in logs/analytics
- Technical messages preserved for debugging

### 4. **Smarter Retry Logic**
- Retryability determination
- Retry delay calculation (respects retry-after headers)
- Category-specific retry strategies

### 5. **Telemetry & Analytics**
- Error codes for tracking (`LLM_TIMEOUT`, `LLM_RATE_LIMIT`, etc.)
- Category-based error rate monitoring
- Provider-specific error analysis

## Error Detection Logic

The categorizer uses multiple signals to classify errors:

1. **HTTP Status Codes** - Primary signal (429, 401, 5xx, etc.)
2. **Error Names** - `AbortError`, `ECONNRESET`, etc.
3. **Error Messages** - Pattern matching for specific error types
4. **Error Codes** - Node.js error codes
5. **Headers** - `retry-after` for rate limits

Order matters: more specific checks (timeout, rate limit) come before generic checks (server error, unknown).

## Auto-Pause on Critical Errors

### Overview

When critical LLM errors occur during job processing, the system automatically pauses the job and stores structured error details for display in the UI.

### Critical Errors (Auto-Pause)

These errors require user intervention and trigger automatic job pause:

- **AUTH_ERROR**: Invalid or expired API key, or organization verification required (user must fix in Settings or verify organization at provider)
- **QUOTA_EXCEEDED**: Billing/quota issue (user must resolve with provider)
- **CONTENT_FILTERED**: Safety filter triggered (user may want to adjust prompt)

### Transient Errors (No Auto-Pause)

These errors are retryable and do not trigger auto-pause:

- **RATE_LIMIT**: Will resolve with retry-after
- **TIMEOUT**: Transient network issue
- **NETWORK_ERROR**: Transient connection issue
- **SERVER_ERROR**: Provider issue, will resolve
- **TOKEN_LIMIT**: Can retry with reduced tokens
- **UNSUPPORTED_PARAMETER**: Can retry with sanitized params

### Functions

#### `shouldPauseOnError(error: CategorizedLLMError): boolean`

Determines if an error should trigger automatic job pause.

```typescript
const error = categorizeLLMError(apiError, "openai");
if (shouldPauseOnError(error)) {
  // Pause job and store error details
}
```

**Returns**: `true` for AUTH_ERROR, QUOTA_EXCEEDED, CONTENT_FILTERED; `false` for all other categories.

#### `buildJobErrorDetails(error, context): JobErrorDetails`

Builds structured error details for storage in the database when pausing a job.

```typescript
const errorDetails = buildJobErrorDetails(categorizedError, {
  rowNumber: 5,           // 1-based for user display
  promptIndex: 2,          // 0-based array index
  promptOutputColumn: "Summary",
  modelId: "gpt-4o",      // Optional
});
```

**Returns**: `JobErrorDetails` object with category, messages, context, provider/model, timestamp, and metadata.

#### `validateJobErrorDetails(details: unknown): JobErrorDetails | null`

Validates error details structure when reading from the database. Handles type coercion and validates required fields.

```typescript
const validated = validateJobErrorDetails(rawErrorDetails);
if (validated) {
  // Display error modal with validated details
} else {
  // Show fallback UI
}
```

**Returns**: Validated `JobErrorDetails` or `null` if invalid.

### JobErrorDetails Interface

```typescript
interface JobErrorDetails {
  category: LLMErrorCategory;
  userMessage: string;
  technicalMessage: string;
  rowNumber: number;              // 1-based for user display
  promptIndex: number;            // 0-based array index
  promptOutputColumn: string;
  provider: SupportedModel;
  modelId?: string;
  timestamp: string;              // ISO 8601
  metadata: CategorizedLLMError["metadata"];
}
```

### Usage in Worker

```typescript
if (!response.success && response.categorizedError) {
  const error = response.categorizedError;
  
  if (shouldPauseOnError(error)) {
    // Build error details with context
    const errorDetails = buildJobErrorDetails(error, {
      rowNumber: rowIndex + 1,
      promptIndex: promptIndex,
      promptOutputColumn: prompt.outputColumnName,
      modelId: prompt.modelId,
    });
    
    // Atomic update: pause job and store error details
    await db.update(enrichmentJobs)
      .set({ status: "paused", errorDetails })
      .where(and(
        eq(enrichmentJobs.jobId, jobId),
        or(eq(enrichmentJobs.status, "processing"), eq(enrichmentJobs.status, "queued")) // Race condition guard
      ));
  }
}
```

### Usage in UI

```typescript
// Validate error details from database
const validated = validateJobErrorDetails(job.errorDetails);

if (validated) {
  // Display error modal with validated details
  // Show category, user message, context, actions
} else {
  // Show fallback UI for invalid/malformed error details
}
```

## Future Enhancements

1. **Provider-Specific Handling**
   - Custom categorization per provider
   - Provider-specific retry strategies

2. **Error Aggregation**
   - Track error rates per category
   - Alert on high error rates

3. **User-Facing Improvements**
   - Show error category in UI (optional)
   - Suggest fixes based on category
   - Error history/analytics dashboard

4. **Retry Strategies**
   - Category-specific retry policies
   - Circuit breaker pattern for repeated failures

5. **Telemetry Integration**
   - Send categorized errors to analytics
   - Error rate dashboards
   - Provider health monitoring

## Testing

To test error categorization:

```typescript
import { categorizeLLMError } from "./llm.errors";

// Test timeout error
const timeoutError = { name: "AbortError", message: "The operation was aborted" };
const categorized = categorizeLLMError(timeoutError, "openai");
console.assert(categorized.category === "TIMEOUT");
console.assert(categorized.retryable === true);

// Test rate limit
const rateLimitError = { status: 429, headers: { "retry-after": "60" } };
const categorized2 = categorizeLLMError(rateLimitError, "openai");
console.assert(categorized2.category === "RATE_LIMIT");
console.assert(categorized2.metadata.retryAfter === 60);

// Test organization verification error
const orgError = { 
  status: 404, 
  message: "Your organization must be verified to use the model `gpt-5-mini`" 
};
const categorized3 = categorizeLLMError(orgError, "openai");
console.assert(categorized3.category === "AUTH_ERROR");
console.assert(categorized3.retryable === false);
console.assert(categorized3.userMessage.includes("organization must be verified"));
```

## Migration Notes

- **Backward Compatible**: Existing code using `response.error` continues to work
- **Gradual Adoption**: Can adopt categorized errors incrementally
- **No Breaking Changes**: `categorizedError` is optional in `LLMResponse`


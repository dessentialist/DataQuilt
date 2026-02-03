/**
 * Test suite for LLM error categorization and job error handling
 * 
 * Tests cover:
 * - shouldPauseOnError() for all error categories
 * - buildJobErrorDetails() structure building
 * - validateJobErrorDetails() with various invalid inputs
 * 
 * Run: node --import tsx shared/llm.errors.test.ts
 */

import assert from "node:assert/strict";
import {
  shouldPauseOnError,
  buildJobErrorDetails,
  validateJobErrorDetails,
  type CategorizedLLMError,
  type JobErrorDetails,
  type LLMErrorCategory,
} from "./llm.errors";

// Test helper: Create a categorized error
function createCategorizedError(
  category: LLMErrorCategory,
  retryable: boolean = false,
  userMessage: string = "Test error",
  technicalMessage: string = "Technical test error",
  metadata: Partial<CategorizedLLMError["metadata"]> = {},
): CategorizedLLMError {
  return {
    category,
    retryable,
    userMessage,
    technicalMessage,
    metadata: {
      provider: "openai",
      ...metadata,
    },
  };
}

async function testShouldPauseOnError() {
  console.log("Testing shouldPauseOnError()...");

  // Critical errors that SHOULD pause
  const pauseCategories: LLMErrorCategory[] = ["AUTH_ERROR", "QUOTA_EXCEEDED", "CONTENT_FILTERED"];
  for (const category of pauseCategories) {
    const error = createCategorizedError(category);
    assert.equal(
      shouldPauseOnError(error),
      true,
      `${category} should trigger pause`,
    );
  }

  // Non-critical errors that should NOT pause
  const noPauseCategories: LLMErrorCategory[] = [
    "TIMEOUT",
    "RATE_LIMIT",
    "API_ERROR",
    "SERVER_ERROR",
    "NETWORK_ERROR",
    "TOKEN_LIMIT",
    "UNSUPPORTED_PARAMETER",
    "UNKNOWN",
  ];
  for (const category of noPauseCategories) {
    const error = createCategorizedError(category);
    assert.equal(
      shouldPauseOnError(error),
      false,
      `${category} should NOT trigger pause`,
    );
  }

  console.log("✅ shouldPauseOnError() tests passed");
}

async function testBuildJobErrorDetails() {
  console.log("Testing buildJobErrorDetails()...");

  const error = createCategorizedError("AUTH_ERROR", false, "Invalid API key", "401 Unauthorized", {
    statusCode: 401,
    errorCode: "invalid_api_key",
    provider: "anthropic",
  });

  const context = {
    rowNumber: 5,
    promptIndex: 2,
    promptOutputColumn: "Summary",
    modelId: "gpt-4o",
  };

  const details = buildJobErrorDetails(error, context);

  // Validate structure
  assert.equal(details.category, "AUTH_ERROR", "category should match");
  assert.equal(details.userMessage, "Invalid API key", "userMessage should match");
  assert.equal(details.technicalMessage, "401 Unauthorized", "technicalMessage should match");
  assert.equal(details.rowNumber, 5, "rowNumber should be 1-based");
  assert.equal(details.promptIndex, 2, "promptIndex should be 0-based");
  assert.equal(details.promptOutputColumn, "Summary", "promptOutputColumn should match");
  assert.equal(details.provider, "anthropic", "provider should use categorized provider");
  assert.equal(details.modelId, "gpt-4o", "modelId should use context.modelId");
  assert.ok(details.timestamp, "timestamp should be set");
  assert.equal(details.metadata.statusCode, 401, "metadata should be preserved");

  // Test with missing modelId (should use error.metadata.errorCode)
  const error2 = createCategorizedError("QUOTA_EXCEEDED", false, "Quota exceeded", "429 Too Many Requests", {
    errorCode: "quota_exceeded",
  });
  const details2 = buildJobErrorDetails(error2, {
    rowNumber: 1,
    promptIndex: 0,
    promptOutputColumn: "Output",
  });
  assert.equal(details2.modelId, "quota_exceeded", "modelId should fallback to error.metadata.errorCode");

  // Test with missing provider (should default to openai)
  const error3 = createCategorizedError("CONTENT_FILTERED", false, "Content filtered", "Content policy violation", {
    provider: undefined,
  });
  const details3 = buildJobErrorDetails(error3, {
    rowNumber: 1,
    promptIndex: 0,
    promptOutputColumn: "Output",
  });
  assert.equal(details3.provider, "openai", "provider should default to openai");

  console.log("✅ buildJobErrorDetails() tests passed");
}

async function testValidateJobErrorDetails() {
  console.log("Testing validateJobErrorDetails()...");

  // Valid error details
  const validDetails: JobErrorDetails = {
    category: "AUTH_ERROR",
    userMessage: "Invalid API key",
    technicalMessage: "401 Unauthorized",
    rowNumber: 5,
    promptIndex: 2,
    promptOutputColumn: "Summary",
    provider: "openai",
    modelId: "gpt-4o",
    timestamp: new Date().toISOString(),
    metadata: { statusCode: 401 },
  };
  const validated = validateJobErrorDetails(validDetails);
  assert.ok(validated, "valid details should pass validation");
  assert.equal(validated!.category, "AUTH_ERROR", "validated category should match");

  // Null/undefined should return null
  assert.equal(validateJobErrorDetails(null), null, "null should return null");
  assert.equal(validateJobErrorDetails(undefined), null, "undefined should return null");

  // Non-object should return null
  assert.equal(validateJobErrorDetails("string"), null, "string should return null");
  assert.equal(validateJobErrorDetails(123), null, "number should return null");
  assert.equal(validateJobErrorDetails([]), null, "array should return null");

  // Missing required fields
  const missingCategory = { ...validDetails };
  delete (missingCategory as any).category;
  assert.equal(validateJobErrorDetails(missingCategory), null, "missing category should return null");

  const missingUserMessage = { ...validDetails };
  delete (missingUserMessage as any).userMessage;
  assert.equal(validateJobErrorDetails(missingUserMessage), null, "missing userMessage should return null");

  const missingRowNumber = { ...validDetails };
  delete (missingRowNumber as any).rowNumber;
  assert.equal(validateJobErrorDetails(missingRowNumber), null, "missing rowNumber should return null");

  const missingPromptIndex = { ...validDetails };
  delete (missingPromptIndex as any).promptIndex;
  assert.equal(validateJobErrorDetails(missingPromptIndex), null, "missing promptIndex should return null");

  const missingOutputColumn = { ...validDetails };
  delete (missingOutputColumn as any).promptOutputColumn;
  assert.equal(validateJobErrorDetails(missingOutputColumn), null, "missing promptOutputColumn should return null");

  const missingProvider = { ...validDetails };
  delete (missingProvider as any).provider;
  assert.equal(validateJobErrorDetails(missingProvider), null, "missing provider should return null");

  const missingTimestamp = { ...validDetails };
  delete (missingTimestamp as any).timestamp;
  assert.equal(validateJobErrorDetails(missingTimestamp), null, "missing timestamp should return null");

  // Wrong types
  const wrongRowNumber = { ...validDetails, rowNumber: "5" };
  assert.equal(validateJobErrorDetails(wrongRowNumber), null, "rowNumber as string should return null");

  const wrongPromptIndex = { ...validDetails, promptIndex: "2" };
  assert.equal(validateJobErrorDetails(wrongPromptIndex), null, "promptIndex as string should return null");

  // Invalid category
  const invalidCategory = { ...validDetails, category: "INVALID_CATEGORY" };
  assert.equal(validateJobErrorDetails(invalidCategory), null, "invalid category should return null");

  // Valid category edge cases
  const allCategories: LLMErrorCategory[] = [
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
  for (const category of allCategories) {
    const testDetails = { ...validDetails, category };
    const result = validateJobErrorDetails(testDetails);
    assert.ok(result, `${category} should be valid`);
    assert.equal(result!.category, category, `validated category should be ${category}`);
  }

  // Optional modelId should be preserved
  const withModelId = { ...validDetails, modelId: "gpt-4o" };
  const validatedWithModelId = validateJobErrorDetails(withModelId);
  assert.equal(validatedWithModelId!.modelId, "gpt-4o", "modelId should be preserved");

  const withoutModelId = { ...validDetails };
  delete (withoutModelId as any).modelId;
  const validatedWithoutModelId = validateJobErrorDetails(withoutModelId);
  assert.ok(validatedWithoutModelId, "missing modelId should still be valid");
  assert.equal(validatedWithoutModelId!.modelId, undefined, "modelId should be undefined when missing");

  // Type coercion (string numbers should be converted)
  const coercedDetails = {
    ...validDetails,
    rowNumber: "5" as any,
    promptIndex: "2" as any,
  };
  // Should fail validation (type check happens before coercion)
  assert.equal(validateJobErrorDetails(coercedDetails), null, "string numbers should fail type check");

  // Empty metadata should default to {}
  const emptyMetadata = { ...validDetails };
  delete (emptyMetadata as any).metadata;
  const validatedEmpty = validateJobErrorDetails(emptyMetadata);
  assert.ok(validatedEmpty, "missing metadata should still be valid");
  assert.deepEqual(validatedEmpty!.metadata, {}, "metadata should default to {}");

  // String coercion for text fields
  // Note: Validation checks !field, so we need truthy values that can be coerced to strings
  // Numbers and booleans are truthy, so they pass the check and get coerced
  const stringCoercion = {
    ...validDetails,
    userMessage: 123 as any, // Number should be coerced to "123"
    technicalMessage: true as any, // Boolean should be coerced to "true"
    promptOutputColumn: 42 as any, // Number should be coerced to "42" (truthy, passes !field check)
    timestamp: new Date() as any, // Date object should be converted to ISO string
  };
  const validatedCoerced = validateJobErrorDetails(stringCoercion);
  assert.ok(validatedCoerced, "coercion should work for string fields");
  assert.equal(typeof validatedCoerced!.userMessage, "string", "userMessage should be coerced to string");
  assert.equal(validatedCoerced!.userMessage, "123", "userMessage should be '123'");
  assert.equal(typeof validatedCoerced!.technicalMessage, "string", "technicalMessage should be coerced to string");
  assert.equal(validatedCoerced!.technicalMessage, "true", "technicalMessage should be 'true'");
  assert.equal(typeof validatedCoerced!.promptOutputColumn, "string", "promptOutputColumn should be coerced to string");
  assert.equal(validatedCoerced!.promptOutputColumn, "42", "promptOutputColumn should be '42'");
  assert.equal(typeof validatedCoerced!.timestamp, "string", "timestamp should be coerced to string");
  assert.ok(validatedCoerced!.timestamp.includes("T") || validatedCoerced!.timestamp.includes("Z"), "timestamp should be ISO format");

  console.log("✅ validateJobErrorDetails() tests passed");
}

async function run() {
  try {
    await testShouldPauseOnError();
    await testBuildJobErrorDetails();
    await testValidateJobErrorDetails();
    console.log("\n✅ All llm.errors tests passed!");
  } catch (err: any) {
    console.error("\n❌ Test failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();


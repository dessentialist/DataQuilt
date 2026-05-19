/**
 * Test suite for JobErrorModal errorDetails validation
 * 
 * Tests cover:
 * - validateJobErrorDetails() integration with modal
 * - Invalid errorDetails fallback UI
 * - Valid errorDetails rendering logic
 * 
 * Run: node --import tsx client/src/components/core/JobErrorModal.error-pause.test.ts
 */

import assert from "node:assert/strict";
import { validateJobErrorDetails, type JobErrorDetails } from "@shared/llm.errors";

/**
 * Simulate JobErrorModal validation logic
 * This mirrors the validation in JobErrorModal.tsx
 */
function shouldShowFallbackUI(errorDetails: unknown): boolean {
  const validated = validateJobErrorDetails(errorDetails);
  return !validated; // Show fallback if validation fails
}

/**
 * Simulate JobErrorModal category badge logic
 */
function getCategoryBadge(category: string): { variant: string; label: string } {
  switch (category) {
    case "AUTH_ERROR":
      return { variant: "destructive", label: "Authentication Error" };
    case "QUOTA_EXCEEDED":
      return { variant: "destructive", label: "Quota Exceeded" };
    case "CONTENT_FILTERED":
      return { variant: "default", label: "Content Filtered" };
    default:
      return { variant: "default", label: category };
  }
}

async function testModalValidationWithValidErrorDetails() {
  console.log("Testing modal validation with valid errorDetails...");

  const validErrorDetails: JobErrorDetails = {
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

  const validated = validateJobErrorDetails(validErrorDetails);
  assert.ok(validated, "valid errorDetails should pass validation");
  assert.equal(shouldShowFallbackUI(validErrorDetails), false, "should NOT show fallback UI for valid errorDetails");

  // Test category badge
  const badge = getCategoryBadge(validated!.category);
  assert.equal(badge.variant, "destructive", "AUTH_ERROR should have destructive variant");
  assert.equal(badge.label, "Authentication Error", "AUTH_ERROR should have correct label");

  console.log("✅ Modal validation with valid errorDetails tests passed");
}

async function testModalValidationWithInvalidErrorDetails() {
  console.log("Testing modal validation with invalid errorDetails...");

  // Test various invalid errorDetails scenarios
  const invalidScenarios = [
    { name: "null", value: null },
    { name: "undefined", value: undefined },
    { name: "string", value: "invalid" },
    { name: "missing category", value: { userMessage: "test" } },
    { name: "missing rowNumber", value: { category: "AUTH_ERROR", userMessage: "test" } },
    { name: "wrong type rowNumber", value: { category: "AUTH_ERROR", userMessage: "test", rowNumber: "5" } },
    { name: "invalid category", value: { category: "INVALID", userMessage: "test", rowNumber: 5, promptIndex: 0, promptOutputColumn: "test", provider: "openai", timestamp: new Date().toISOString() } },
  ];

  for (const scenario of invalidScenarios) {
    const validated = validateJobErrorDetails(scenario.value);
    assert.equal(validated, null, `${scenario.name} should fail validation`);
    assert.equal(shouldShowFallbackUI(scenario.value), true, `${scenario.name} should show fallback UI`);
  }

  console.log("✅ Modal validation with invalid errorDetails tests passed");
}

async function testModalCategoryBadges() {
  console.log("Testing modal category badges...");

  const categories = [
    { category: "AUTH_ERROR", expectedVariant: "destructive", expectedLabel: "Authentication Error" },
    { category: "QUOTA_EXCEEDED", expectedVariant: "destructive", expectedLabel: "Quota Exceeded" },
    { category: "CONTENT_FILTERED", expectedVariant: "default", expectedLabel: "Content Filtered" },
    { category: "UNKNOWN", expectedVariant: "default", expectedLabel: "UNKNOWN" },
  ];

  for (const test of categories) {
    const badge = getCategoryBadge(test.category);
    assert.equal(badge.variant, test.expectedVariant, `${test.category} should have ${test.expectedVariant} variant`);
    assert.equal(badge.label, test.expectedLabel, `${test.category} should have correct label`);
  }

  console.log("✅ Modal category badges tests passed");
}

async function testModalErrorDetailsContext() {
  console.log("Testing modal errorDetails context display...");

  const errorDetails: JobErrorDetails = {
    category: "QUOTA_EXCEEDED",
    userMessage: "Quota exceeded",
    technicalMessage: "429 Too Many Requests",
    rowNumber: 10, // 1-based for display
    promptIndex: 3, // 0-based, displayed as promptIndex + 1
    promptOutputColumn: "Analysis",
    provider: "gemini",
    modelId: "gemini-pro",
    timestamp: new Date().toISOString(),
    metadata: { statusCode: 429 },
  };

  const validated = validateJobErrorDetails(errorDetails);
  assert.ok(validated, "errorDetails should be valid");

  // Verify context fields are accessible for display
  assert.equal(validated!.rowNumber, 10, "rowNumber should be 1-based");
  assert.equal(validated!.promptIndex, 3, "promptIndex should be 0-based");
  assert.equal(validated!.promptOutputColumn, "Analysis", "promptOutputColumn should match");
  assert.equal(validated!.provider, "gemini", "provider should match");
  assert.equal(validated!.modelId, "gemini-pro", "modelId should match");

  // Display logic: promptIndex + 1 for user display
  const displayPromptNumber = validated!.promptIndex + 1;
  assert.equal(displayPromptNumber, 4, "prompt should display as 4 (promptIndex + 1)");

  console.log("✅ Modal errorDetails context tests passed");
}

async function testProcessMonitorErrorDetection() {
  console.log("Testing ProcessMonitor error detection logic...");

  // Simulate ProcessMonitor error detection: job.status === "paused" && job.errorDetails
  const scenarios = [
    {
      name: "paused with errorDetails",
      status: "paused" as const,
      errorDetails: { category: "AUTH_ERROR" } as JobErrorDetails,
      shouldShowModal: true,
    },
    {
      name: "paused without errorDetails",
      status: "paused" as const,
      errorDetails: null,
      shouldShowModal: false,
    },
    {
      name: "processing with errorDetails",
      status: "processing" as const,
      errorDetails: { category: "AUTH_ERROR" } as JobErrorDetails,
      shouldShowModal: false, // Only show when paused
    },
    {
      name: "completed with errorDetails",
      status: "completed" as const,
      errorDetails: { category: "AUTH_ERROR" } as JobErrorDetails,
      shouldShowModal: false, // Only show when paused
    },
    {
      name: "stopped with errorDetails",
      status: "stopped" as const,
      errorDetails: { category: "AUTH_ERROR" } as JobErrorDetails,
      shouldShowModal: false, // Only show when paused
    },
  ];

  for (const scenario of scenarios) {
    const hasError = scenario.status === "paused" && scenario.errorDetails !== null;
    assert.equal(
      hasError,
      scenario.shouldShowModal,
      `${scenario.name}: shouldShowModal should be ${scenario.shouldShowModal}`,
    );
  }

  console.log("✅ ProcessMonitor error detection tests passed");
}

async function run() {
  try {
    await testModalValidationWithValidErrorDetails();
    await testModalValidationWithInvalidErrorDetails();
    await testModalCategoryBadges();
    await testModalErrorDetailsContext();
    await testProcessMonitorErrorDetection();
    console.log("\n✅ All JobErrorModal error pause tests passed!");
  } catch (err: any) {
    console.error("\n❌ Test failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();


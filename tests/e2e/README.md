# E2E Tests: Auto-Pause on Critical LLM Errors

End-to-end tests that verify the complete flow of auto-pause functionality with real API errors.

## Overview

These tests exercise the full system with real API calls:
1. Create test user with invalid API keys (triggers AUTH_ERROR)
2. Create job with test CSV
3. Worker processes job and encounters error
4. Verify auto-pause triggered
5. Verify errorDetails stored correctly
6. Test resume/stop functionality

## Prerequisites

### Required Environment Variables

```bash
ENCRYPTION_KEY=<32-byte encryption key for API keys>
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Replit Setup

In Replit, ensure these secrets are set:
1. Go to Secrets tab
2. Add `ENCRYPTION_KEY` (32 bytes, base64 encoded)
3. Add `SUPABASE_URL`
4. Add `SUPABASE_SERVICE_ROLE_KEY`

## Running Tests

```bash
# Run all E2E tests
npm run test:error-pause:e2e

# Or run directly
node --import tsx tests/e2e/error-pause.e2e.test.ts
```

## Test Scenarios

### 1. AUTH_ERROR Auto-Pause
- Creates user with invalid OpenAI API key
- Creates job with 3-row CSV
- Worker processes job and hits AUTH_ERROR
- Verifies job auto-pauses
- Verifies errorDetails stored correctly
- Verifies error logs created

### 2. Resume After Error
- Creates job that auto-pauses due to error
- Resumes job via API
- Verifies errorDetails cleared
- Verifies job status changed to processing

### 3. Stop After Error
- Creates job that auto-pauses due to error
- Stops job via API
- Verifies errorDetails cleared
- Verifies job status changed to stopped

## Test Data

Tests create temporary data:
- Test user with email `e2e-test-<uuid>@example.com`
- Test CSV file with 3 rows
- Test job with single prompt

All test data is automatically cleaned up after each test.

## Timeouts

- Job processing timeout: 60 seconds
- Poll interval: 1 second

## Notes

- Tests use real database (Supabase)
- Tests use real worker (JobProcessor)
- Tests use invalid API keys to trigger real AUTH_ERROR
- Compatible with Replit environment (no browser automation)
- Tests are isolated (each test cleans up its data)

## Troubleshooting

### Test Fails: "ENCRYPTION_KEY environment variable is required"
- Ensure `ENCRYPTION_KEY` is set in Replit secrets
- Key must be 32 bytes (base64 encoded)

### Test Fails: "SUPABASE_URL environment variable is required"
- Ensure `SUPABASE_URL` is set in Replit secrets
- Should be your Supabase project URL

### Test Fails: "SUPABASE_SERVICE_ROLE_KEY environment variable is required"
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Replit secrets
- Should be your Supabase service role key (not anon key)

### Test Times Out
- Worker may be slow to process
- Increase timeout in test (currently 60 seconds)
- Check worker logs for errors

### Cleanup Fails
- Test data may remain in database
- Manually clean up test users/files/jobs if needed
- Look for users with email pattern `e2e-test-*@example.com`


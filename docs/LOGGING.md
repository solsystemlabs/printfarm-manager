# Logging Standards

This document describes the logging infrastructure and standards for the PrintFarm Manager application.

## Overview

All logs use structured JSON format for machine readability and easy filtering. Cloudflare Workers automatically captures all `console.log()` and `console.error()` output with 100% request sampling enabled.

## Logger Utilities

The logger utilities are located in `/src/lib/utils/logger.ts`:

### `log(event, data)`

General-purpose logging for informational events.

```typescript
import { log } from '~/lib/utils/logger'

log('request_complete', {
  method: 'GET',
  path: '/api/files',
  status: 200,
  durationMs: 45
})
```

### `logError(event, error, data)`

Error logging with full details. Stack traces are logged to console only (never exposed to users per NFR-6).

```typescript
import { logError } from '~/lib/utils/logger'

try {
  // operation that might fail
} catch (error) {
  logError('api_error', error, {
    operation: 'file_upload',
    fileName: 'document.pdf'
  })
}
```

### `logPerformance(event, durationMs, data)`

Performance metric logging for identifying slow operations (per NFR-9).

```typescript
import { logPerformance } from '~/lib/utils/logger'

const startTime = Date.now()
// ... perform operation ...
logPerformance('file_upload_performance', Date.now() - startTime, {
  fileSize: 1024000,
  fileName: 'document.pdf'
})
```

## Error Response Utility

The error response utility is located in `/src/lib/utils/errors.ts`:

### `createErrorResponse(code, message, statusCode, options)`

Creates sanitized error responses for API endpoints. Logs full error details (including stack traces) to console only. Returns clean error responses to clients without exposing stack traces.

```typescript
import { createErrorResponse } from '~/lib/utils/errors'

// Simple error
return createErrorResponse('NOT_FOUND', 'File not found', 404)

// With validation details
return createErrorResponse('VALIDATION_ERROR', 'Invalid file type', 400, {
  field: 'fileType',
  details: { expected: ['pdf', 'png'], received: 'exe' }
})

// With original error (logged to console, not exposed to client)
try {
  // operation
} catch (error) {
  return createErrorResponse(
    'INTERNAL_ERROR',
    'An unexpected error occurred',
    500,
    { originalError: error }
  )
}
```

## JSON Log Format

All logs follow this structured format:

```json
{
  "timestamp": "2025-10-18T04:06:57.267Z",
  "event": "health_check",
  "environment": "development",
  "method": "GET",
  "path": "/api/health",
  "status": 200,
  "durationMs": 12,
  "databaseConfigured": true
}
```

### Required Fields

- `timestamp` - ISO 8601 timestamp
- `event` - Event type identifier
- `environment` - Current environment (development, staging, production)

### Common Event Types

- `request_start` - API request initiated
- `request_complete` - API request succeeded
- `request_error` - API request failed
- `health_check` - Health check endpoint accessed
- `api_error` - Application error occurred
- `[operation]_performance` - Performance metric (e.g., `file_upload_performance`, `search_query_performance`)

## Accessing Logs

### Local Development

View logs in your terminal when running `npm run dev`. Structured JSON logs appear in the console output.

### Real-Time Tailing (Deployed Environments)

```bash
# Tail staging logs
npx wrangler tail --env staging

# Tail production logs
npx wrangler tail --env production
```

### Cloudflare Dashboard

1. Navigate to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Workers & Pages** → Select your worker
3. Click **Logs** tab

**Filtering Options:**
- Environment (via custom filters on `environment` field)
- Status code
- Time range
- Search by event type or custom fields

## Log Retention

- **Free tier:** 24 hours
- **Paid tier:** 7 days (if upgraded)

## Security and Privacy

### Never Log Sensitive Data

❌ **DO NOT** log:
- Passwords or authentication tokens
- API keys or secrets
- Personally Identifiable Information (PII)
- Credit card numbers or financial data
- Session tokens or cookies

### Stack Traces

✅ Stack traces are logged to console for debugging (visible in Cloudflare logs)

❌ Stack traces are **NEVER** exposed in API responses to users (per NFR-6)

The error response utility automatically handles this:
- Full error details (including stack) → Console logs only
- Sanitized error messages → API responses

## Performance Monitoring

Use `logPerformance()` to identify slow operations (per NFR-9):

```typescript
const startTime = Date.now()

// Upload file to R2
await uploadToR2(file)

logPerformance('r2_upload_performance', Date.now() - startTime, {
  fileSize: file.size,
  bucket: 'printfarm-files'
})
```

**Monitor these operations:**
- File uploads to R2
- PDF text extraction
- Database queries
- Search operations
- External API calls

## Observability Configuration

Observability is enabled in `wrangler.jsonc`:

```jsonc
{
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1  // 100% request sampling
  }
}
```

This ensures all requests are logged with full context for debugging and performance analysis.

## Example Usage

### API Route Handler with Logging

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { log, logError, logPerformance } from '~/lib/utils/logger'
import { createErrorResponse } from '~/lib/utils/errors'

export const Route = createFileRoute('/api/files')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now()

        log('request_start', {
          method: request.method,
          path: '/api/files'
        })

        try {
          // Process file upload
          const file = await request.formData()

          // Log performance
          logPerformance('file_upload_performance', Date.now() - startTime, {
            fileSize: file.get('file').size
          })

          log('request_complete', {
            method: request.method,
            path: '/api/files',
            status: 201,
            durationMs: Date.now() - startTime
          })

          return json({ success: true }, { status: 201 })
        } catch (error) {
          return createErrorResponse(
            'UPLOAD_ERROR',
            'Failed to upload file',
            500,
            { originalError: error }
          )
        }
      }
    }
  }
})
```

## References

- [Cloudflare Workers Observability](https://developers.cloudflare.com/workers/observability/logging/)
- [Real-Time Logs (wrangler tail)](https://developers.cloudflare.com/workers/wrangler/commands/#tail)

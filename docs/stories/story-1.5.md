# Story 1.5: Implement Logging and Observability

Status: ContextReadyDraft

## Story

As a developer,
I want comprehensive logging for all API requests and errors,
so that I can debug issues in staging/production environments.

## Acceptance Criteria

1. Cloudflare Workers logs accessible in Dashboard for all environments
2. All API route handlers log request method, path, status code, duration
3. Error responses logged with descriptive messages (never stack traces per NFR-6)
4. Performance metrics logged: upload times, extraction times, search query times (per NFR-9)
5. Environment indicator (dev/staging/production) logged with each request
6. Logs filterable by environment, status code, time range in Cloudflare Dashboard
7. 100% request sampling confirmed operational (observability config from Story 1.1)

## Tasks / Subtasks

- [ ] Create logger utility with structured JSON format (AC: #2, #3, #4, #5)
  - [ ] Create `/src/lib/utils/logger.ts` with `log()`, `logError()`, and `logPerformance()` functions
  - [ ] Implement structured JSON schema with timestamp, event, environment, and custom data fields
  - [ ] Ensure environment is retrieved from Cloudflare context (`getContext('cloudflare').env.ENVIRONMENT`)
  - [ ] Add TypeScript types for LogEvent interface

- [ ] Create error response utility (AC: #3)
  - [ ] Create `/src/lib/utils/errors.ts` with `createErrorResponse()` function
  - [ ] Define ApiError interface with code, message, field, details
  - [ ] Log full error details (including stack trace) to console only
  - [ ] Return sanitized error response to client (no stack traces exposed)

- [ ] Update health check endpoint with logging (AC: #2, #5, #7)
  - [ ] Modify `/src/routes/api/health.ts` to use logger utility
  - [ ] Log health check events with environment context
  - [ ] Verify structured JSON logs appear in console

- [ ] Test logging in all environments (AC: #1, #6, #7)
  - [ ] Test local development: verify console output shows structured JSON
  - [ ] Deploy to staging: verify logs accessible in Cloudflare Dashboard
  - [ ] Test real-time tailing: `npx wrangler tail --env staging`
  - [ ] Verify logs filterable by environment, time range in Dashboard
  - [ ] Confirm 100% request sampling operational (from Story 1.1 observability config)

- [ ] Create logging documentation (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Create `/docs/LOGGING.md` with logging standards
  - [ ] Document JSON log format and event types
  - [ ] Document how to access logs (Dashboard and CLI)
  - [ ] Document log retention (24 hours free tier, 7 days paid)
  - [ ] Include examples of structured logs for common events

## Dev Notes

### Technical Approach

**Structured Logging with JSON Format:**

All logs use consistent JSON schema for machine readability and human readability when pretty-printed. The logger utility provides three core functions:

1. **`log(event, data)`** - General-purpose logging for informational events
2. **`logError(event, error, data)`** - Error logging with full details (stack traces logged to console only, never exposed to users)
3. **`logPerformance(event, durationMs, data)`** - Performance metric logging for operations like uploads, extractions, queries

**Key Logging Principles:**

Per tech spec Story 1.5 (lines 1592-1598):
- Never log sensitive data (passwords, tokens, PII)
- Never expose stack traces to users (log to console only per NFR-6)
- Always include context (environment, timestamp, event type)
- Log performance metrics (identify slow operations per NFR-9)
- Use event-based naming (e.g., `request_complete`, not just "request")

**Cloudflare Workers Observability:**

Cloudflare Workers automatically captures all `console.log()`, `console.error()`, etc. output. With observability enabled (Story 1.1, `head_sampling_rate: 1`), 100% of requests are logged.

**Log Access Methods:**

1. **Real-Time Tailing:** `npx wrangler tail --env staging` or `--env production`
2. **Cloudflare Dashboard:** Workers & Pages → printfarm-manager → Logs tab
3. **Filtering:** Dashboard supports filtering by environment, status code, time range

**Log Retention:**
- Free tier: 24 hours
- Paid tier: 7 days (if upgraded)

**Event Types:**

Per tech spec Story 1.5 (lines 903-909):
- `request_start` - API request initiated
- `request_complete` - API request succeeded
- `request_error` - API request failed
- `[operation]_performance` - Performance metric (e.g., `file_upload_performance`)
- `health_check` - Health check endpoint accessed
- `api_error` - Application error occurred

### Project Structure Notes

**Files to Create:**

- `/src/lib/utils/logger.ts` - Core logging utility with `log()`, `logError()`, `logPerformance()`
- `/src/lib/utils/errors.ts` - Error response utility with `createErrorResponse()`
- `/docs/LOGGING.md` - Logging standards and access documentation

**Files to Modify:**

- `/src/routes/api/health.ts` - Add logging to existing health check endpoint

**Alignment with Project Structure:**

This story establishes the logging foundation for all subsequent feature development. Epic 2-5 features will use these logging utilities for request logging, error logging, and performance metrics.

The logger utility uses Cloudflare context (`getContext('cloudflare')`) to access environment variables, following the pattern established in CLAUDE.md (lines 172-174).

### References

**Source Documents:**

- [Source: docs/tech-spec-epic-1.md, Story 1.5, lines 673-967] - Complete technical specification for logging implementation
- [Source: docs/epics.md, Story 1.5, lines 131-153] - User story and acceptance criteria
- [Source: CLAUDE.md, Working with Cloudflare Workers Context section, lines 39-94] - `getContext('cloudflare')` usage examples

**Technical Standards:**

- Logs must use structured JSON format (tech spec line 687)
- Never expose stack traces to users (NFR-6, tech spec line 698)
- Log performance metrics for operations (NFR-9, tech spec lines 701-703)
- 100% request sampling via observability config (tech spec line 707, from Story 1.1)

**Cloudflare Workers Documentation:**

- [Workers Observability](https://developers.cloudflare.com/workers/observability/logging/)
- [Real-Time Logs (wrangler tail)](https://developers.cloudflare.com/workers/wrangler/commands/#tail)

**Implementation Examples:**

Per tech spec lines 712-1951, complete code examples provided for:
- Logger utility (`src/lib/utils/logger.ts`, lines 715-763)
- Error response utility (`src/lib/utils/errors.ts`, lines 846-881)
- Health check endpoint with logging (`src/routes/api/health.ts`, lines 814-841)
- Logging standards documentation (`docs/LOGGING.md`, lines 886-931)
- Structured logging patterns (lines 1917-1949)

## Dev Agent Record

### Context Reference

- /home/taylor/projects/printfarm-manager/docs/story-context-1.1.5.xml

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

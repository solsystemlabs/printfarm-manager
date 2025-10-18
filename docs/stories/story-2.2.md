# Story 2.2: Implement Model File Upload API

Status: Draft

## Story

As an owner,
I want to upload individual .stl and .3mf files via web interface,
so that I can add new models to my catalog.

## Acceptance Criteria

1. API endpoint `/api/models/upload` accepts POST requests
2. Validates file type (only .stl, .3mf allowed per FR-1)
3. Validates file size (≤500MB per NFR-2, though individual models typically smaller)
4. Uploads file to R2 bucket with unique filename (UUID-based)
5. Sets proper content-type and content-disposition headers when uploading to R2 (per FR-16)
6. Creates database record with metadata: filename, size, content-type, R2 URL
7. Returns upload success response with model ID and URL
8. Handles errors gracefully: file too large, invalid type, R2 upload failure
9. Cleans up R2 file if database creation fails (atomic operation per NFR-4)
10. Logs upload operation per NFR-9 (filename, size, outcome, duration)

## Tasks / Subtasks

- [ ] Create API Endpoint for Model Upload (AC: #1, #2, #3, #4, #5, #9, #10)
  - [ ] Create `/src/routes/api/models/upload.ts`
  - [ ] Define POST handler with file upload processing
  - [ ] Validate file type against ALLOWED_EXTENSIONS ['.stl', '.3mf']
  - [ ] Validate file size (MAX_FILE_SIZE = 500MB)
  - [ ] Generate UUID-based R2 key: `models/${crypto.randomUUID()}${extension}`
  - [ ] Upload to R2 with content-type and content-disposition headers
  - [ ] Implement cleanup on database failure (atomic operation)
  - [ ] Add structured logging for upload start/complete/error

- [ ] Create Database Record (AC: #6, #9)
  - [ ] Use Prisma client to create Model record
  - [ ] Store: filename, r2Key, r2Url, fileSize, contentType
  - [ ] Wrap in try-catch for cleanup on failure

- [ ] Implement Error Response Handler (AC: #7, #8)
  - [ ] Create error response utility if not exists
  - [ ] Return 201 on success with model details
  - [ ] Return 400 for missing file or invalid type
  - [ ] Return 413 for file too large
  - [ ] Return 500 for R2 or database failures

- [ ] Add Performance Logging (AC: #10)
  - [ ] Log upload_start with filename, size, content_type
  - [ ] Log upload_complete with model_id, duration_ms
  - [ ] Log upload_error with duration_ms and error details

## Dev Notes

### Technical Approach

**File Upload Strategy:**

This story implements the foundation for all file storage in PrintFarm Manager. The implementation follows the atomic operation pattern established in NFR-4:

1. **Upload to R2 first** - Store file in object storage
2. **Create database record second** - Link metadata to R2 object
3. **Cleanup on failure** - Delete R2 file if database creation fails

This ordering ensures that we never have orphaned database records pointing to missing files. Orphaned R2 files (no database record) can be cleaned up via background job in Phase 2.

**Validation Strategy:**

Per tech spec lines 339-383, validation occurs in two stages:
- **File size validation:** Reject files >500MB immediately (before R2 upload)
- **File extension validation:** Check against whitelist ['.stl', '.3mf']

Content-type validation is lenient - we accept multiple MIME types since .stl files may have inconsistent content-type headers across different sources:
- `model/stl`
- `application/sla`
- `application/octet-stream`

**R2 Header Configuration:**

Per FR-16 and tech spec lines 397-400, we must set explicit headers:
```typescript
httpMetadata: {
  contentType: file.type || 'application/octet-stream',
  contentDisposition: `attachment; filename="${file.name}"`,
}
```

This ensures downloads work correctly with proper filename preservation.

**Error Handling:**

Per tech spec lines 437-451, all errors are caught and returned via `createErrorResponse` utility with:
- HTTP status code (400, 413, 500)
- Error code constant ('MISSING_FILE', 'FILE_TOO_LARGE', etc.)
- Descriptive error message

### Project Structure Notes

**Files to Create:**

- `/src/routes/api/models/upload.ts` - Main API endpoint handler
- `/src/lib/utils/logger.ts` - Structured logging utility (if not exists from Epic 1)
- `/src/lib/utils/errors.ts` - Error response utility (if not exists from Epic 1)

**Alignment with Project Structure:**

This story follows TanStack Start API route patterns:
- Routes defined in `src/routes/api/` directory
- Use `createFileRoute()` with `server.handlers` object
- POST handler uses `{ request }` parameter for form data access
- Cloudflare context accessed via `getContext('cloudflare')`

**Database Integration:**

Uses Prisma client singleton from Story 2.1:
```typescript
import { prisma } from '~/lib/db/client'
```

The `Model` entity schema supports:
- `filename` (String) - Original upload filename
- `r2Key` (String) - Unique R2 storage key
- `r2Url` (String) - Full R2 URL for access
- `fileSize` (Int) - Bytes, for storage tracking
- `contentType` (String) - MIME type for proper download headers

**R2 Bucket Binding:**

Accesses R2 via Cloudflare environment binding established in Epic 1:
```typescript
const cf = getContext('cloudflare')
const bucket = cf.env.FILES_BUCKET
```

Environment-specific bucket names (configured in wrangler.jsonc):
- Development: `pm-dev-files`
- Staging: `pm-staging-files`
- Production: `pm-files`

### References

**Source Documents:**

- [Source: docs/epics.md, Story 2.2, lines 241-263] - User story and acceptance criteria
- [Source: docs/tech-spec-epic-2.md, Story 2.2, lines 315-470] - Complete implementation specification with code examples

**Technical Standards:**

- Atomic operations pattern (tech spec line 437-440, NFR-4)
- Max file size: 500MB (tech spec line 339, NFR-2)
- Allowed file types: .stl, .3mf (tech spec lines 340-341, FR-1)
- UUID-based R2 keys (tech spec line 393)
- Structured logging with performance metrics (tech spec lines 385-389, 418-424, NFR-9)
- Content-disposition header: `attachment; filename="..."` (tech spec line 399, FR-16)

**API Response Format:**

Per tech spec lines 426-435, success response (201) includes:
```json
{
  "id": "uuid",
  "filename": "original-name.stl",
  "r2Url": "https://bucket.r2.cloudflarestorage.com/models/uuid.stl",
  "thumbnailUrl": null,
  "fileSize": 1234567,
  "createdAt": "2025-10-18T..."
}
```

**Error Response Codes:**

Per tech spec and epics acceptance criteria:
- 400: Missing file or invalid file type
- 413: File too large
- 500: R2 upload failure or database error

**Logging Events:**

Per tech spec lines 385-389, 418-424, 442-445:
- `model_upload_start` - filename, size, content_type
- `model_upload_complete` - model_id, filename, size, duration_ms
- `model_upload_error` - error details, duration_ms

**Database Cleanup on Failure:**

Per tech spec lines 437-441:
```typescript
try {
  const model = await prisma.model.create({ data })
  return json({ ...model }, { status: 201 })
} catch (dbError) {
  await bucket.delete(r2Key) // Cleanup R2 on DB failure
  throw dbError
}
```

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML/JSON will be added here by context workflow -->

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

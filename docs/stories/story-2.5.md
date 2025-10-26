# Story 2.5: Implement Slice File Upload API

Status: ContextReadyDraft

## Story

As an owner,
I want to upload .gcode.3mf and .gcode slice files,
so that I can attach sliced configurations to my models.

## Acceptance Criteria

1. API endpoint `/api/slices/upload` accepts POST requests
2. Validates file type (.gcode.3mf, .gcode per FR-2)
3. Validates file size (≤50MB per NFR-2)
4. Uploads file to R2 with unique filename
5. Sets proper content-type and content-disposition headers
6. Creates database record with metadata: filename, size, content-type, R2 URL
7. metadataExtracted defaults to false (Epic 3 will handle extraction)
8. Returns upload success response with slice ID and URL
9. Handles errors gracefully with appropriate status codes
10. Cleans up R2 file if database creation fails (atomic operation per NFR-4)
11. Logs upload operation with performance metrics per NFR-9

## Tasks / Subtasks

- [ ] Create Slice Upload API Endpoint (AC: #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11)
  - [ ] Create `/src/routes/api/slices/upload.ts` file
  - [ ] Implement POST handler following TanStack Start pattern
  - [ ] Access Cloudflare context and R2 bucket binding
  - [ ] Validate file presence in FormData
  - [ ] Validate file extension (.gcode.3mf, .gcode) - case-insensitive
  - [ ] Validate file size (≤50MB max)
  - [ ] Generate unique R2 key with UUID prefix
  - [ ] Upload file to R2 with proper httpMetadata headers
  - [ ] Create Prisma database record (slice table)
  - [ ] Set metadataExtracted = false (default for MVP)
  - [ ] Return 201 response with slice metadata
  - [ ] Implement R2 cleanup on database failure (try-catch around DB create)
  - [ ] Add structured logging (start, complete, error events)

- [ ] Implement File Validation Utilities (AC: #2, #3)
  - [ ] Create validation constants (MAX_SLICE_SIZE = 50MB)
  - [ ] Create ALLOWED_EXTENSIONS array ['.gcode.3mf', '.gcode']
  - [ ] Implement extension validation logic (handle .gcode.3mf correctly)
  - [ ] Implement size validation with descriptive error messages
  - [ ] Return appropriate HTTP status codes (400 for invalid type, 413 for too large)

- [ ] Implement Error Handling (AC: #9, #10)
  - [ ] Use createErrorResponse utility from ~/lib/utils/errors
  - [ ] Handle missing file (400 MISSING_FILE)
  - [ ] Handle invalid file type (400 INVALID_FILE_TYPE)
  - [ ] Handle file too large (413 FILE_TOO_LARGE)
  - [ ] Handle R2 upload failure (500 R2_UPLOAD_FAILED)
  - [ ] Handle database creation failure (500 DB_CREATE_FAILED)
  - [ ] Implement cleanup: delete R2 file if DB creation fails
  - [ ] Log all errors with duration metrics

- [ ] Add Structured Logging (AC: #11)
  - [ ] Log slice_upload_start with filename, size, content_type
  - [ ] Log slice_upload_complete with slice_id, filename, size, duration_ms
  - [ ] Log slice_upload_error with error details and duration_ms
  - [ ] Follow existing logging patterns from Story 2.2

- [ ] Write Unit Tests
  - [ ] Test valid .gcode.3mf upload succeeds
  - [ ] Test valid .gcode upload succeeds
  - [ ] Test file too large (>50MB) returns 413
  - [ ] Test invalid file type (.stl, .zip, .txt) returns 400
  - [ ] Test missing file returns 400
  - [ ] Test case-insensitive extension matching (.GCODE, .Gcode)
  - [ ] Test R2 upload failure handling
  - [ ] Test database creation failure triggers R2 cleanup
  - [ ] Test metadataExtracted defaults to false
  - [ ] Test response includes all required fields (id, filename, r2Url, etc.)

- [ ] Create Simple Test UI (Optional)
  - [ ] Create `/src/routes/test/upload-slice.tsx` page
  - [ ] Add file input accepting .gcode.3mf and .gcode files
  - [ ] Display file size validation warnings
  - [ ] Show upload progress/status
  - [ ] Display upload result (slice ID, URL, etc.)
  - [ ] Provide link to slice detail page (when available in Story 2.8)

## Dev Notes

### Technical Approach

**Slice Upload Pattern (Follows Story 2.2):**

This story implements slice file upload API following the same atomic pattern established in Story 2.2 for model uploads. Key differences:
- **File types**: .gcode.3mf and .gcode (vs .stl and .3mf for models)
- **Max file size**: 50MB (vs 500MB for models per NFR-2)
- **Database entity**: `slices` table (vs `models` table)
- **R2 prefix**: `slices/` (vs `models/`)
- **Metadata extraction**: Deferred to Epic 3 (metadataExtracted = false)

**Atomic Upload Flow:**

Per NFR-4 and Story 2.2 pattern, the upload must be atomic (R2 + DB):

```typescript
try {
  // 1. Upload to R2 first
  await bucket.put(r2Key, file, { httpMetadata: {...} })

  // 2. Create database record second
  try {
    const slice = await prisma.slice.create({...})
    return json(slice, { status: 201 })
  } catch (dbError) {
    // 3. Cleanup R2 on DB failure
    await bucket.delete(r2Key)
    throw dbError
  }
} catch (error) {
  // 4. Return error to client
  return createErrorResponse(error, 500, 'UPLOAD_FAILED')
}
```

**Why This Order Matters:**

Per Story 2.2 dev notes and NFR-4:
- R2 upload first → can be retried cheaply
- DB creation second → if fails, delete R2 file (no orphans)
- Alternative order (DB → R2) would create orphaned DB records pointing to non-existent files

**File Extension Validation:**

Critical consideration: `.gcode.3mf` has TWO dots. Extension checking must handle this correctly:

```typescript
// ❌ WRONG: file.name.split('.').pop() returns '3mf' (misses .gcode)
// ✅ CORRECT: ALLOWED_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext))

const ALLOWED_EXTENSIONS = ['.gcode.3mf', '.gcode']
const hasValidExtension = ALLOWED_EXTENSIONS.some(ext =>
  file.name.toLowerCase().endsWith(ext)
)
```

Order matters: Check `.gcode.3mf` BEFORE `.gcode` to avoid false positives.

**Metadata Extraction Placeholder:**

Per AC#7 and epics.md technical notes, metadata extraction is **deferred to Epic 3**. This story only:
- Uploads the raw slice file to R2
- Creates database record with `metadataExtracted = false`
- Returns basic file metadata (filename, size, URL)

Epic 3 Story 3.1 will parse .gcode.3mf files and populate:
- `metadataJson` field (complete extracted JSON)
- Curated fields (layerHeight, nozzleTemp, bedTemp, etc.)
- Filament associations via `slice_filaments` junction table

**Content-Type Headers:**

Per FR-16 and Story 2.2 pattern, R2 uploads must set explicit headers:

```typescript
await bucket.put(r2Key, file, {
  httpMetadata: {
    contentType: file.type || 'application/octet-stream',
    contentDisposition: `attachment; filename="${file.name}"`,
  },
})
```

The `contentDisposition: attachment` header forces browsers to **download** (not display) slice files when accessed via R2 URL. This is critical for .gcode files which browsers might try to render as text.

**R2 Key Naming Strategy:**

Following Story 2.2 pattern:
- Prefix: `slices/` (organizes R2 bucket by entity type)
- UUID: `crypto.randomUUID()` (prevents name collisions)
- Original filename: Appended for debugging/identification
- Example: `slices/550e8400-e29b-41d4-a716-446655440000-baby-whale-red.gcode.3mf`

### Architecture Constraints

**Cloudflare Workers Context:**

Per CLAUDE.md, the API endpoint runs on Cloudflare Workers with:
- **Memory limit**: 128MB per request (slice files ≤50MB, well within limit)
- **Execution limit**: 30 seconds CPU time (file upload happens asynchronously)
- **R2 access**: Via `cf.env.FILES_BUCKET` binding
- **Database**: Prisma client targeting Xata PostgreSQL
- **Environment**: Accessed via `getContext('cloudflare')`

**R2 Bucket Configuration:**

Per Story 1.3 (Epic 1) and wrangler.jsonc:
- Bucket binding name: `FILES_BUCKET`
- Environment-specific buckets:
  - Development: `pm-dev-files`
  - Staging: `pm-staging-files`
  - Production: `pm-files`
- Versioning enabled (for disaster recovery per NFR-12)
- CORS configured for application domains

**Database Schema:**

Per Story 2.1 and tech-spec-epic-2.md lines 123-156, the `slices` table includes:

```prisma
model Slice {
  id                String   @id @default(uuid())
  tenantId          String?  @map("tenant_id") // nullable in MVP
  filename          String
  r2Key             String   @map("r2_key")
  r2Url             String   @map("r2_url")
  fileSize          Int      @map("file_size")
  contentType       String   @map("content_type")
  thumbnailUrl      String?  @map("thumbnail_url")
  metadataExtracted Boolean  @default(false) @map("metadata_extracted")
  metadataJson      Json?    @map("metadata_json") // Epic 3

  // Curated metadata fields (Epic 3)
  layerHeight      Float?   @map("layer_height")
  nozzleTemp       Int?     @map("nozzle_temp")
  bedTemp          Int?     @map("bed_temp")
  printSpeed       Int?     @map("print_speed")
  infillPercent    Int?     @map("infill_percent")
  supportsEnabled  Boolean? @map("supports_enabled")
  estimatedTimeSec Int?     @map("estimated_time_sec")
  filamentUsedG    Float?   @map("filament_used_g")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

This story only populates: `id`, `filename`, `r2Key`, `r2Url`, `fileSize`, `contentType`, `metadataExtracted` (= false).

All other fields remain null until Epic 3.

**Error Handling Standards:**

Per NFR-6 and Story 2.2 patterns:
- Use `createErrorResponse()` utility for consistent error format
- Never expose stack traces to clients (sanitize errors)
- Log full error details server-side with `logError()`
- Return appropriate HTTP status codes:
  - 400: Client error (missing file, invalid type)
  - 413: Payload too large (>50MB)
  - 500: Server error (R2 failure, DB failure)

**Logging Standards:**

Per NFR-9 and Story 2.2 patterns, log structured events:

```typescript
// Start event
log('slice_upload_start', {
  filename: file.name,
  size: file.size,
  content_type: file.type,
})

// Success event
log('slice_upload_complete', {
  slice_id: slice.id,
  filename: slice.filename,
  size: slice.fileSize,
  duration_ms: Date.now() - startTime,
})

// Error event
logError('slice_upload_error', error, {
  duration_ms: Date.now() - startTime,
})
```

All events include `duration_ms` for performance monitoring.

### Implementation Differences from Story 2.2

**Similarities (Reuse Pattern):**
- Atomic upload flow (R2 → DB → cleanup on failure)
- Error handling utilities (createErrorResponse, logError)
- Structured logging with performance metrics
- R2 header configuration (content-type, content-disposition)
- UUID-based R2 key generation

**Differences:**
| Aspect | Story 2.2 (Models) | Story 2.5 (Slices) |
|--------|-------------------|-------------------|
| File types | .stl, .3mf | .gcode.3mf, .gcode |
| Max file size | 500MB | 50MB |
| R2 prefix | `models/` | `slices/` |
| Database table | `models` | `slices` |
| API endpoint | `/api/models/upload` | `/api/slices/upload` |
| Metadata | None (simple models) | metadataExtracted flag (Epic 3) |

### UI Context

**Where Slice Uploads Happen:**

Per epics.md technical notes (line 313-314):
> "Slice uploads happen from model detail pages (UI context)"

This means:
- Users navigate to a specific model's detail page
- From there, they upload a slice file associated with that model
- The slice-to-model association happens in Epic 4 via `slice_models` junction table

**For MVP/Story 2.5:**
- Create standalone slice upload API (no model association yet)
- Optional: Create test UI at `/test/upload-slice` for manual testing
- Epic 4 will add UI for uploading slices from model detail pages

### Project Structure Notes

**New Files to Create:**

- `/src/routes/api/slices/upload.ts` - Slice upload API endpoint
- `/src/routes/test/upload-slice.tsx` - Test UI (optional, for manual testing)
- `/src/__tests__/routes/api/slices/upload.test.ts` - API endpoint unit tests

**Files to Reference (Not Modify):**

- `/src/lib/utils/errors.ts` - Error handling utilities (from Story 2.2)
- `/src/lib/utils/logger.ts` - Logging utilities (from Story 2.2)
- `/src/lib/db/client.ts` - Prisma client factory (from Story 2.1)
- `/prisma/schema.prisma` - Database schema (from Story 2.1)

**Alignment with Story 2.2:**

This story directly parallels Story 2.2 but for a different entity type:
- **Story 2.2**: Upload models (.stl, .3mf) → `models` table
- **Story 2.5**: Upload slices (.gcode.3mf, .gcode) → `slices` table

Code structure should be nearly identical, with only minor changes:
- File type validation constants
- Max file size constant
- R2 key prefix
- Database table name
- Metadata flag (metadataExtracted)

**Testing Alignment:**

Test structure should mirror Story 2.2 tests:
- Valid upload scenarios
- File size validation
- File type validation
- Error handling (R2 failure, DB failure)
- Atomicity verification (R2 cleanup on DB failure)

### References

**Source Documents:**

- [Source: docs/epics.md, Story 2.5, lines 295-318] - User story and acceptance criteria
- [Source: docs/tech-spec-epic-2.md, Story 2.5, lines 1075-1224] - Complete implementation specification
- [Source: docs/stories/story-2.2.md] - Model upload pattern (template for this story)
- [Source: docs/stories/story-2.1.md] - Database schema reference
- [Source: CLAUDE.md, Cloudflare Workers Context] - Environment access and bindings

**Technical Standards:**

- Allowed file types: .gcode.3mf, .gcode [epics.md line 297, FR-2]
- Max file size: 50MB [epics.md line 298, NFR-2]
- Atomic operations: R2 first, DB second, cleanup on failure [NFR-4]
- Error handling: No stack traces exposed [NFR-6]
- Logging: Structured with performance metrics [NFR-9]
- Content headers: Explicit content-type and content-disposition [FR-16]

**Database Schema:**

- Table: `slices` [tech-spec-epic-2.md lines 123-156]
- Required fields: id, filename, r2Key, r2Url, fileSize, contentType, metadataExtracted
- Default values: metadataExtracted = false
- Optional fields (Epic 3): metadataJson, curated fields, thumbnailUrl
- Relationships (Epic 3+): sliceFilaments, sliceModels, sliceVariants

**API Response Format:**

Per tech spec lines 1183-1193, success response (201) includes:

```json
{
  "id": "uuid",
  "filename": "baby-whale-red.gcode.3mf",
  "r2Url": "https://pm-staging-files.r2.cloudflarestorage.com/slices/...",
  "metadataExtracted": false,
  "fileSize": 25829120,
  "createdAt": "2025-10-25T10:30:00Z"
}
```

**Error Response Codes:**

- 400 MISSING_FILE: No file in FormData
- 400 INVALID_FILE_TYPE: File extension not in ['.gcode.3mf', '.gcode']
- 413 FILE_TOO_LARGE: File size > 50MB
- 500 R2_UPLOAD_FAILED: R2 bucket.put() failed
- 500 DB_CREATE_FAILED: Prisma slice.create() failed
- 500 UPLOAD_FAILED: Generic unexpected error

## Dev Agent Record

### Context Reference

- [Story Context 2.5](/home/taylor/projects/printfarm-manager/docs/story-context-2.2.5.xml) - Generated 2025-10-25

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

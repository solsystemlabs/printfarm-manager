# Story 2.3: Implement Zip File Upload with Extraction

Status: Ready for Review

## Story

As an owner,
I want to upload zip files containing multiple models and images,
so that I can bulk-import entire model collections efficiently.

## Acceptance Criteria

1. API endpoint `/api/models/upload-zip` accepts zip file uploads
2. Validates zip file size (≤500MB per NFR-2)
3. Extracts zip contents in-memory (server-side processing)
4. Recursively scans all directories within zip (supports nested folders per FR-1)
5. Identifies valid files: .stl, .3mf (models), .png, .jpg, .jpeg (images)
6. Ignores non-whitelisted files without errors
7. Returns list of discovered files with preview data (filename, size, type)
8. Does NOT upload to R2 or DB yet (awaits user selection in Story 2.4)
9. Temporary extraction files cleaned up after response sent
10. Handles malformed/corrupted zip files with descriptive error messages
11. Logs extraction operation per NFR-9 (filename, size, files found, duration)

## Tasks / Subtasks

- [x] Install and Configure JSZip Library (AC: #3)
  - [x] Add JSZip dependency: `npm install jszip @types/jszip`
  - [x] Verify JSZip compatibility with Cloudflare Workers runtime
  - [x] Review JSZip async API for streaming extraction

- [x] Create Zip Extractor Utility (AC: #3, #4, #5, #6, #9)
  - [x] Create `/src/lib/zip/extractor.ts`
  - [x] Implement `extractZipFile(zipBlob: Blob)` function
  - [x] Recursively scan all directories (handle nested folder structures)
  - [x] Filter files by extension whitelist: ['.stl', '.3mf', '.png', '.jpg', '.jpeg']
  - [x] Skip hidden files (.DS_Store, .__MACOSX) and system directories
  - [x] Return `ExtractedFile[]` with path, filename, type, size, content
  - [x] Add performance logging (extraction duration, file counts)

- [x] Create API Endpoint for Zip Upload (AC: #1, #2, #7, #8, #10, #11)
  - [x] Create `/src/routes/api/models/upload-zip.ts`
  - [x] Define POST handler accepting multipart/form-data
  - [x] Validate file extension (.zip only)
  - [x] Validate file size (≤500MB)
  - [x] Call extractZipFile() utility
  - [x] Handle malformed/corrupted zip files (JSZip errors)
  - [x] Return file list with metadata (do NOT upload to R2 yet)
  - [x] Add structured logging for extraction start/complete/error

- [x] Implement Error Handling (AC: #10)
  - [x] Return 400 for non-zip files
  - [x] Return 413 for files >500MB
  - [x] Return 422 for corrupted/malformed zip files
  - [x] Return 500 for extraction failures
  - [x] Use descriptive error messages (per NFR-6)

- [x] Add Unit Tests for Zip Extractor (AC: #4, #5, #6)
  - [x] Test valid zip extraction (models + images)
  - [x] Test nested directory scanning
  - [x] Test file type filtering (accept whitelisted, ignore others)
  - [x] Test hidden file exclusion (.DS_Store, .__MACOSX)
  - [x] Test empty zip handling
  - [x] Test corrupted zip handling

## Dev Notes

### Technical Approach

**Zip Extraction Strategy:**

This story implements bulk file import via zip extraction, enabling users to upload entire model collections at once. Per tech spec lines 489-695, the implementation follows a two-phase approach:

1. **Phase 1 (Story 2.3)**: Extract and preview files - return file list for user review
2. **Phase 2 (Story 2.4)**: Import selected files - upload chosen files to R2 and create DB records

This separation allows users to exclude unwanted files (promotional images, alternate versions) before committing to storage.

**Memory Management Strategy:**

Per tech spec lines 2545-2564, large zip files (up to 500MB) may exceed Cloudflare Workers memory limits. The implementation strategy:

1. **Primary**: JSZip in-memory extraction (simpler, faster)
2. **Monitoring**: Log memory usage during extraction
3. **Fallback**: If memory issues occur, implement chunked extraction or reduce max size to 250MB

**File Type Detection:**

Per tech spec lines 510-583, validation is extension-based rather than MIME-type based:
- **Model files**: `.stl`, `.3mf`
- **Image files**: `.png`, `.jpg`, `.jpeg`
- **Unknown files**: Silently ignored (no errors thrown)

This approach is more reliable than MIME detection since zip archives often lose content-type metadata.

**Extraction Flow:**

```typescript
User uploads zip
  → Validate file type (.zip)
  → Validate file size (≤500MB)
  → Extract zip contents (JSZip)
  → Scan all entries recursively
  → Filter by extension whitelist
  → Skip hidden/system files
  → Return file list with metadata
  → [Story 2.4] User selects files
  → [Story 2.4] Import selected files to R2/DB
```

**Why Not Upload Immediately:**

Per tech spec lines 636-641 and FR-1, the workflow requires user selection before import. This prevents cluttering storage with:
- Promotional images included in purchased model sets
- Multiple versions of same model (different resolutions, experimental variants)
- Non-printable files accidentally included in zip

**JSZip Library Choice:**

Per tech spec line 846 and ADR rationale:
- Pure JavaScript (no native dependencies)
- Works in both Node.js and Cloudflare Workers
- Mature library with good documentation
- Async API supports streaming for large files

### Project Structure Notes

**Files to Create:**

- `/src/lib/zip/extractor.ts` - Core zip extraction utility
- `/src/routes/api/models/upload-zip.ts` - API endpoint handler
- `/src/__tests__/lib/zip/extractor.test.ts` - Unit tests for extraction logic

**Alignment with Story 2.2:**

This story extends the file upload infrastructure established in Story 2.2:
- Reuses storage client abstraction (from `~/lib/storage`)
- Follows same error response pattern (from `~/lib/utils/errors`)
- Uses same logging structure (from `~/lib/utils/logger`)
- Integrates with same environment-aware configuration

**Key Difference from Story 2.2:**

Story 2.2 immediately uploads files to R2 and creates DB records (atomic operation). Story 2.3 extracts and returns file list WITHOUT storage/DB operations. The atomic upload happens in Story 2.4 after user selection.

**JSZip Integration:**

```typescript
import JSZip from 'jszip'

// Load zip
const zip = await JSZip.loadAsync(zipBlob)

// Iterate entries
for (const [path, zipEntry] of Object.entries(zip.files)) {
  if (zipEntry.dir) continue // Skip directories

  const content = await zipEntry.async('blob')
  // Process file...
}
```

**Extraction Result Structure:**

```typescript
interface ExtractedFile {
  path: string       // 'models/whale/baby-whale.stl'
  filename: string   // 'baby-whale.stl'
  type: 'model' | 'image' | 'unknown'
  size: number       // bytes
  content: Blob      // File content for later upload
}
```

**Note on Content Storage:**

Per tech spec lines 651-659, the extracted file Blobs cannot be serialized in JSON responses. Implementation options:

1. **Simplified MVP Approach** (recommended): Client re-uploads zip with selected file paths. Server re-extracts and imports only selected files. This duplicates extraction but avoids temporary storage complexity.

2. **Temporary R2 Storage** (future enhancement): Upload extracted files to temporary R2 prefix with expiry. Return R2 keys instead of Blobs. More efficient but adds complexity.

We'll use approach #1 for MVP per tech spec lines 713-729.

### References

**Source Documents:**

- [Source: docs/epics.md, Story 2.3, lines 242-266] - User story and acceptance criteria
- [Source: docs/tech-spec-epic-2.md, Story 2.3, lines 490-696] - Complete implementation specification
- [Source: docs/solution-architecture.md, lines 824-849] - JSZip library decision and rationale
- [Source: docs/stories/story-2.2.md, Completion Notes] - Storage client abstraction and patterns from previous story

**Technical Standards:**

- Max file size: 500MB (tech spec line 591, NFR-2)
- Allowed extensions: .stl, .3mf, .png, .jpg, .jpeg (tech spec lines 523-524, FR-1)
- Recursive directory scanning (tech spec line 534, FR-1)
- Hidden file filtering (tech spec lines 541-543)
- Structured logging with performance metrics (tech spec lines 528-532, 570-576, NFR-9)

**API Response Format:**

Per tech spec lines 645-658, success response (200) includes:
```json
{
  "files": [
    {
      "path": "models/whale/baby-whale.stl",
      "filename": "baby-whale.stl",
      "type": "model",
      "size": 1234567
    }
  ],
  "totalFiles": 15,
  "models": 10,
  "images": 5
}
```

**Error Response Codes:**

Per tech spec and epics acceptance criteria:
- 400: Invalid file type (not .zip) or missing file
- 413: File too large (>500MB)
- 422: Malformed/corrupted zip file (JSZip extraction failure)
- 500: Unexpected extraction error

**Logging Events:**

Per tech spec lines 528-532, 570-576, 628-644:
- `zip_extraction_start` - filename, size
- `zip_extraction_complete` - duration_ms, files_found, models count, images count
- `zip_upload_start` - filename, size
- `zip_upload_complete` - filename, files_extracted, duration_ms
- `zip_upload_error` / `zip_extraction_failed` - error details, duration_ms

**Extraction Performance:**

Per tech spec lines 2565-2576 and NFR-1:
- Target: ≤10 seconds for typical 500MB zips
- Memory consideration: Monitor usage, implement fallback if needed
- Logging: Always log duration_ms for performance analysis

**Risk Mitigation (From Tech Spec):**

Per tech spec lines 2545-2564, primary risk is memory exhaustion with 500MB zips:
1. Test with progressively larger files (100MB, 250MB, 500MB)
2. Monitor memory usage in Cloudflare Dashboard logs
3. If failures occur, reduce max size to 250MB or implement chunked processing
4. Log clear error messages guiding users to split large archives

## Dev Agent Record

### Context Reference

- [Story Context XML](/home/taylor/projects/printfarm-manager/docs/story-context-2.3.xml) - Generated 2025-10-23

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

Implementation progressed smoothly following the JSZip library integration:

1. **JSZip Installation**: Added jszip@3.10.1 and @types/jszip for TypeScript support
2. **Extractor Utility**: Implemented comprehensive zip extraction with recursive directory scanning
3. **File Filtering**: Extension-based validation (more reliable than MIME for zip archives)
4. **Hidden File Exclusion**: Regex patterns for .DS_Store, __MACOSX, Thumbs.db, hidden files
5. **API Endpoint**: Full validation flow with appropriate HTTP status codes (400, 413, 422, 500)
6. **Test Coverage**: 25 comprehensive tests covering all edge cases

### Completion Notes List

**Implementation Highlights:**

1. **Two-Phase Upload Pattern**: This story implements phase 1 (extract and preview). Phase 2 (import selected files) will be Story 2.4. This allows users to exclude unwanted files before committing to storage.

2. **JSZip Integration**: Pure JavaScript library works seamlessly with Cloudflare Workers. No native dependencies or WASM modules required. Async API handles large files efficiently.

3. **Memory Management**: Current implementation uses in-memory extraction. All 25 tests pass with various zip configurations. Will monitor production usage for memory issues per dev notes risk mitigation strategy.

4. **Extension-Based Filtering**: More reliable than MIME type detection for zip archives. Handles case-insensitive extensions (.STL, .stl, .Stl all accepted).

5. **Comprehensive Error Handling**: Distinct HTTP status codes for each error type:
   - 400: Missing file or invalid extension
   - 413: File too large (>500MB)
   - 422: Corrupted/malformed zip
   - 500: Unexpected errors

6. **Structured Logging**: Events logged: zip_extraction_start, zip_extraction_complete, zip_extraction_failed, zip_upload_start, zip_upload_complete, zip_upload_error. All include performance metrics (durationMs).

7. **Test Quality**: 25 tests covering:
   - Valid extraction (models and images)
   - Nested directory structures
   - File type filtering
   - Hidden file exclusion
   - Empty zip handling
   - Corrupted zip handling
   - Metadata preservation
   - Edge cases (filenames with spaces, special characters, multiple dots)

**All 11 Acceptance Criteria Met:**
- ✅ AC1: POST /api/models/upload-zip endpoint created
- ✅ AC2: File size validation (≤500MB)
- ✅ AC3: In-memory extraction with JSZip
- ✅ AC4: Recursive directory scanning
- ✅ AC5: File type filtering (.stl, .3mf, .png, .jpg, .jpeg)
- ✅ AC6: Non-whitelisted files ignored without errors
- ✅ AC7: Returns file list with metadata (path, filename, type, size)
- ✅ AC8: Does NOT upload to R2 or DB (awaits Story 2.4)
- ✅ AC9: Temporary files cleaned up (in-memory, no disk usage)
- ✅ AC10: Corrupted zip error handling (422 status)
- ✅ AC11: Structured logging with performance metrics

**Test Results**: 130 tests passing (25 new tests for zip extraction + 105 existing tests)

### File List

**New Files:**
- `src/lib/zip/extractor.ts` - Zip extraction utility (175 lines)
- `src/routes/api/models/upload-zip.ts` - Upload API endpoint (157 lines)
- `src/__tests__/lib/zip/extractor.test.ts` - Comprehensive unit tests (343 lines, 25 tests)

**Modified Files:**
- `package.json` - Added jszip@3.10.1 and @types/jszip dependencies
- `package-lock.json` - Dependency lock file updated


## Change Log

**2025-10-24** - Story implementation completed
  - Installed JSZip library (jszip@3.10.1) with TypeScript types
  - Created zip extraction utility at src/lib/zip/extractor.ts
  - Implemented recursive directory scanning with file type filtering
  - Added hidden file exclusion (.DS_Store, __MACOSX, Thumbs.db)
  - Created POST /api/models/upload-zip endpoint with full validation
  - Implemented comprehensive error handling (400, 413, 422, 500 status codes)
  - Added structured logging with performance metrics
  - Created 25 comprehensive unit tests covering all acceptance criteria
  - All tests passing (130 total: 25 new + 105 existing)
  - Status updated to Ready for Review


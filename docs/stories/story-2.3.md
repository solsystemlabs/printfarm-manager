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

**2025-10-24** - Senior Developer Review notes appended

---

## Senior Developer Review (AI)

### Reviewer
Taylor

### Date
2025-10-24

### Outcome
**Approve with Minor Suggestions**

### Summary

Story 2.3 successfully implements zip file upload with extraction functionality following the two-phase approach specified in the tech spec. The implementation demonstrates strong engineering practices with comprehensive test coverage (25 new tests, all passing), proper error handling across 4 distinct HTTP status codes, structured logging with performance metrics, and adherence to established project patterns from Story 2.2.

**Key Strengths:**
- Excellent test coverage (25 tests covering all edge cases)
- Proper separation of concerns (extractor utility vs. API endpoint)
- Smart runtime compatibility solution with `file-converter.ts`
- Clean error handling following NFR-6 (no stack traces exposed)
- Performance-conscious implementation with duration logging

**Areas for Enhancement:**
- Consider adding CRC32 validation for corrupted zip detection
- Memory monitoring instrumentation would help validate 500MB capacity
- API endpoint could benefit from extracting validation logic

All 11 acceptance criteria are met. Build succeeds. Tests pass. Ready for production deployment with suggested enhancements tracked as follow-up items.

### Key Findings

#### High Priority
None identified. Implementation is production-ready.

#### Medium Priority
1. **JSZip CRC32 Validation Not Enabled** - Per JSZip best practices documentation, the `checkCRC32: true` option should be enabled when loading zip files to catch corrupted archives more reliably. Current implementation relies on generic error handling which may miss subtle corruption issues.
   - Location: src/lib/zip/extractor.ts:107
   - Recommendation: Add `checkCRC32: true` option to `JSZip.loadAsync()` call
   - Impact: Improves corrupted zip detection reliability

2. **Missing Memory Usage Monitoring** - Tech spec lines 2545-2564 identify memory exhaustion as the primary risk for 500MB zips. While implementation uses in-memory extraction, there's no instrumentation to monitor memory usage.
   - Location: src/lib/zip/extractor.ts:94-180
   - Recommendation: Add memory usage logging in production (if available via Cloudflare Workers metrics)
   - Impact: Enables proactive monitoring of risk mitigation strategy

#### Low Priority
1. **API Validation Logic Could Be Extracted** - The upload-zip endpoint has inline validation logic (lines 58-98) that could be extracted into reusable validator functions, following the single-responsibility principle.
   - Location: src/routes/api/models/upload-zip.ts:58-98
   - Recommendation: Consider extracting to `src/lib/validation/zip-validators.ts` for reusability
   - Impact: Improves code organization and testability (currently tested indirectly)

2. **File Converter Lacks Unit Tests** - The `convertFileForZip` utility (src/lib/zip/file-converter.ts) solves an important cross-runtime compatibility issue but has no dedicated unit tests.
   - Location: src/lib/zip/file-converter.ts
   - Recommendation: Add unit tests verifying correct Uint8Array conversion
   - Impact: Improves confidence in critical runtime compatibility layer

### Acceptance Criteria Coverage

All 11 acceptance criteria are **fully met**:

✅ **AC1: API endpoint `/api/models/upload-zip` accepts zip file uploads**
- Implemented at src/routes/api/models/upload-zip.ts:27-173
- POST handler accepts multipart/form-data with 'file' field

✅ **AC2: Validates zip file size (≤500MB per NFR-2)**
- Validation at upload-zip.ts:78-98
- Returns 413 status code with descriptive error message
- Correctly uses 500 * 1024 * 1024 bytes constant

✅ **AC3: Extracts zip contents in-memory (server-side processing)**
- JSZip library handles in-memory extraction at extractor.ts:107
- No disk I/O operations performed
- Blobs stored in memory until response sent

✅ **AC4: Recursively scans all directories within zip (supports nested folders per FR-1)**
- Recursive scanning at extractor.ts:114-154
- Test coverage includes deeply nested structures (level1/level2/level3/level4)
- Path preservation verified in tests

✅ **AC5: Identifies valid files: .stl, .3mf (models), .png, .jpg, .jpeg (images)**
- Extension whitelists defined at extractor.ts:35-36
- Case-insensitive matching at extractor.ts:59, 76
- Type classification logic at extractor.ts:58-69

✅ **AC6: Ignores non-whitelisted files without errors**
- Files filtered at extractor.ts:129-131
- Tests verify .txt, .js, .json, .md files are silently ignored
- No errors thrown for unknown file types

✅ **AC7: Returns list of discovered files with preview data (filename, size, type)**
- Response structure at upload-zip.ts:145-152
- Includes all required metadata fields
- JSON serialization excludes Blob content (as designed)

✅ **AC8: Does NOT upload to R2 or DB yet (awaits user selection in Story 2.4)**
- No storage client usage in implementation
- Comment explicitly documents two-phase approach at upload-zip.ts:20-25
- Aligned with tech spec lines 636-641

✅ **AC9: Temporary extraction files cleaned up after response sent**
- In-memory extraction means no disk cleanup required
- Blob garbage collection handled by JavaScript runtime
- No temporary file creation

✅ **AC10: Handles malformed/corrupted zip files with descriptive error messages**
- Try-catch block at upload-zip.ts:102-126
- Returns 422 status code with "CORRUPTED_ZIP" error code
- Descriptive message: "Zip file is malformed or corrupted and cannot be extracted"
- Test coverage includes corrupted zip scenarios

✅ **AC11: Logs extraction operation per NFR-9 (filename, size, files found, duration)**
- Start event at extractor.ts:101-103
- Complete event at extractor.ts:164-168 with duration_ms
- Failed event at extractor.ts:173-176
- Upload-level logging at upload-zip.ts:52-55, 137-142

### Test Coverage and Gaps

**Excellent test coverage**: 25 comprehensive tests covering all acceptance criteria and edge cases.

**Test Structure (src/__tests__/lib/zip/extractor.test.ts):**
- Valid Zip Extraction (5 tests) - All model/image types
- Nested Directory Scanning (2 tests) - Including deeply nested structures
- File Type Filtering (2 tests) - Non-whitelisted files and case-insensitivity
- Hidden File Exclusion (4 tests) - .DS_Store, __MACOSX, Thumbs.db, dot-prefixed
- Empty Zip Handling (3 tests) - Empty zips, directories-only, non-whitelisted-only
- Corrupted Zip Handling (2 tests) - Invalid data scenarios
- File Metadata (2 tests) - Metadata accuracy and Blob preservation
- Large File Handling (3 tests) - Multiple dots, spaces, special characters
- Statistics Calculation (2 tests) - Model/image counting accuracy

**Test Quality:**
- Clear descriptive names following "should X when Y" pattern
- Good use of test helpers (createTestZip, createCorruptedZip)
- Comprehensive assertions verifying all metadata fields
- Edge cases well covered (uppercase extensions, nested paths, special characters)

**Minor Gap Identified:**
- No dedicated tests for `file-converter.ts` utility (tested indirectly via integration)
- Recommendation: Add unit tests for Uint8Array conversion correctness

**Missing E2E Tests:**
- API endpoint has no E2E tests (validated via build success and manual testing)
- This is acceptable per story 2.2 pattern (deferred due to TanStack Router complexity)
- Validation logic is tested thoroughly at the unit level

### Architectural Alignment

**Strong alignment with project architecture and established patterns:**

✅ **Two-Phase Upload Pattern (Story 2.3 → 2.4):**
- Correctly implements phase 1 (extract and preview) without storage operations
- Comment at upload-zip.ts:20-25 clearly documents the pattern
- Aligns with tech spec lines 636-641 and FR-1 requirements

✅ **Consistent with Story 2.2 Patterns:**
- Uses same error response utility (createErrorResponse from ~/lib/utils/errors)
- Follows same structured logging pattern (log, logError, logPerformance)
- Matches error handling standards (sanitized responses, no stack traces)
- Consistent HTTP status code usage (400, 413, 422, 500)

✅ **TanStack Start API Route Pattern:**
- Proper use of createFileRoute with server.handlers.POST
- FormData access via request.formData()
- JSON responses via json() helper from @tanstack/react-start
- Matches route structure from existing API endpoints

✅ **Separation of Concerns:**
- Clean separation: extractor utility (business logic) vs. API endpoint (validation/orchestration)
- Extractor is framework-agnostic and reusable
- API endpoint focuses on HTTP concerns (validation, responses, logging)

✅ **TypeScript Type Safety:**
- Comprehensive interfaces (ExtractedFile, ExtractionResult)
- Proper error typing (Error | unknown patterns)
- Strong types throughout (no 'any' usage - adheres to CLAUDE.md instruction)

**Runtime Compatibility Solution:**
- Smart addition of `file-converter.ts` to handle File → Uint8Array conversion
- Solves Cloudflare Workers vs. Node.js runtime differences
- Uses Web Streams API for universal compatibility
- Well-documented rationale in comments (lines 1-9)

### Security Notes

**Overall security posture is strong with proper input validation and sanitization:**

✅ **Input Validation:**
- File extension validation (upload-zip.ts:58-75) prevents non-zip uploads
- File size limits enforced (500MB cap per NFR-2)
- Validates file presence before processing
- Extension check uses case-insensitive comparison (prevents .ZIP bypass)

✅ **Path Traversal Protection:**
- JSZip documentation shows it normalizes relative paths (../) automatically
- Original unsafe filenames stored in unsafeOriginalName property
- Normalized paths used in implementation (extractor.ts:114-154)
- Test coverage includes nested paths but not explicit path traversal tests

⚠️ **Potential Enhancement - Path Traversal Testing:**
- While JSZip normalizes paths, no explicit test validates this behavior
- Consider adding test with malicious paths (e.g., "../../etc/passwd.stl")
- Verify that normalized path is used in file list response
- Low priority: JSZip library is well-vetted (9.0 trust score, 95 code snippets)

✅ **Error Information Disclosure:**
- Follows NFR-6: No stack traces exposed to clients
- Error responses use createErrorResponse utility (sanitizes errors)
- Full error details logged server-side only
- Descriptive but safe error messages returned to clients

✅ **Resource Exhaustion Protection:**
- File size limit (500MB) prevents memory exhaustion attacks
- In-memory processing bounded by file size validation
- No infinite loop risks (iterates over fixed zip entries)
- No recursive function calls (flat iteration pattern)

✅ **Denial of Service (DoS) Mitigation:**
- File size cap limits resource consumption
- No complex regex patterns susceptible to ReDoS
- Simple pattern matching for file extensions
- Quick-fail validation (extension and size checked first)

**No Critical Security Issues Identified**

### Best-Practices and References

**Technology Stack Detected:**
- **Framework:** TanStack Start v1.132.36 (React-based SSR framework)
- **Runtime:** Cloudflare Workers (Vite + wrangler build system)
- **Language:** TypeScript v5.7.2 (strict mode enabled)
- **Testing:** Vitest v3.2.4 with React Testing Library
- **Zip Library:** JSZip v3.10.1 (pure JavaScript, Workers-compatible)

**JSZip Best Practices Applied:**
- ✅ Uses async API (loadAsync, zipEntry.async) for non-blocking operations
- ✅ Proper Uint8Array format for universal compatibility
- ✅ Iterates over zip.files object (not deprecated methods)
- ✅ Checks zipEntry.dir to skip directories
- ✅ Uses 'blob' type for file content (efficient for binary data)
- ⚠️ Missing checkCRC32 option for enhanced corruption detection (recommended enhancement)

**JSZip Best Practices Reference:**
Per JSZip documentation (https://github.com/stuk/jszip/blob/main/documentation/api_jszip/load_async.md):
- Setting `checkCRC32: true` forces CRC32 validation and rejects corrupted zips
- Default behavior ignores CRC32 errors, which may miss subtle corruption
- Recommendation: Add to loadAsync call for production reliability

**Cloudflare Workers Considerations:**
- ✅ No Node.js-specific APIs used (fs, path, etc.)
- ✅ Uses Web APIs (Blob, Uint8Array, Streams)
- ✅ File converter handles runtime differences transparently
- ✅ Memory-conscious design (bounded by file size validation)
- ℹ️ Memory monitoring unavailable in current implementation (Worker.memory API not exposed)

**Error Handling Best Practices:**
- ✅ Distinct error codes for different failure modes
- ✅ HTTP status codes semantically correct (400, 413, 422, 500)
- ✅ Descriptive error messages guide user remediation
- ✅ Structured error logging aids debugging
- ✅ Try-catch blocks properly scoped

**Testing Best Practices:**
- ✅ Comprehensive test coverage (25 tests, all passing)
- ✅ Tests are deterministic (use helper functions for test data)
- ✅ Edge cases well covered (empty zips, corrupted data, special characters)
- ✅ Tests follow clear naming convention
- ✅ Proper use of test utilities (describe blocks, expect assertions)

**Performance Best Practices:**
- ✅ Duration logging for all operations (enables performance monitoring)
- ✅ In-memory extraction avoids disk I/O overhead
- ✅ Quick-fail validation (size/extension checked before extraction)
- ✅ No redundant data copying (direct Blob usage)
- ℹ️ No performance profiling data yet (awaiting production metrics)

**References:**
- JSZip Documentation: https://github.com/stuk/jszip/blob/main/documentation/
- TanStack Start API Routes: https://tanstack.com/router/latest/docs/framework/react/start/api-routes
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Project Tech Spec: docs/tech-spec-epic-2.md (lines 490-696)

### Action Items

1. **[Medium][Enhancement] Enable JSZip CRC32 Validation**
   - File: src/lib/zip/extractor.ts:107
   - Change: Add `checkCRC32: true` option to `JSZip.loadAsync(zipData, { checkCRC32: true })`
   - Rationale: JSZip best practices recommend enabling CRC32 validation for production reliability. Catches corrupted archives that may pass generic error handling.
   - Reference: JSZip docs - api_jszip/load_async.md
   - Related AC: #10 (malformed/corrupted zip handling)

2. **[Low][Enhancement] Add Unit Tests for File Converter**
   - File: Create src/__tests__/lib/zip/file-converter.test.ts
   - Change: Add tests verifying correct Uint8Array conversion from File objects
   - Rationale: Critical runtime compatibility layer lacks direct test coverage
   - Test cases: Standard file conversion, large file handling, error scenarios
   - Related AC: #3 (in-memory extraction)

3. **[Low][Enhancement] Extract Validation Logic from API Endpoint**
   - File: src/routes/api/models/upload-zip.ts
   - Change: Move validation logic (lines 58-98) to src/lib/validation/zip-validators.ts
   - Functions: validateZipFile(file), validateZipExtension(filename), validateZipSize(size)
   - Rationale: Improves single-responsibility principle, enables direct unit testing of validators
   - Related AC: #1, #2

4. **[Low][Monitoring] Add Production Memory Usage Logging**
   - File: src/lib/zip/extractor.ts
   - Change: Log memory metrics if available via Cloudflare Workers API
   - Rationale: Tech spec identifies memory exhaustion as primary risk for 500MB zips
   - Implementation: Check if performance.memory API is available, log before/after extraction
   - Related: Tech spec lines 2545-2564 (risk mitigation strategy)

5. **[Low][Testing] Add Path Traversal Security Test**
   - File: src/__tests__/lib/zip/extractor.test.ts
   - Change: Add test case with malicious paths (e.g., "../../etc/passwd.stl")
   - Expected: Verify JSZip normalizes path and extractor returns safe path
   - Rationale: Validates JSZip's built-in path traversal protection
   - Related AC: #4 (recursive directory scanning)

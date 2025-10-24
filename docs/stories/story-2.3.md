# Story 2.3: Implement Zip File Upload with Extraction

Status: Draft

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

- [ ] Install and Configure JSZip Library (AC: #3)
  - [ ] Add JSZip dependency: `npm install jszip @types/jszip`
  - [ ] Verify JSZip compatibility with Cloudflare Workers runtime
  - [ ] Review JSZip async API for streaming extraction

- [ ] Create Zip Extractor Utility (AC: #3, #4, #5, #6, #9)
  - [ ] Create `/src/lib/zip/extractor.ts`
  - [ ] Implement `extractZipFile(zipBlob: Blob)` function
  - [ ] Recursively scan all directories (handle nested folder structures)
  - [ ] Filter files by extension whitelist: ['.stl', '.3mf', '.png', '.jpg', '.jpeg']
  - [ ] Skip hidden files (.DS_Store, .__MACOSX) and system directories
  - [ ] Return `ExtractedFile[]` with path, filename, type, size, content
  - [ ] Add performance logging (extraction duration, file counts)

- [ ] Create API Endpoint for Zip Upload (AC: #1, #2, #7, #8, #10, #11)
  - [ ] Create `/src/routes/api/models/upload-zip.ts`
  - [ ] Define POST handler accepting multipart/form-data
  - [ ] Validate file extension (.zip only)
  - [ ] Validate file size (≤500MB)
  - [ ] Call extractZipFile() utility
  - [ ] Handle malformed/corrupted zip files (JSZip errors)
  - [ ] Return file list with metadata (do NOT upload to R2 yet)
  - [ ] Add structured logging for extraction start/complete/error

- [ ] Implement Error Handling (AC: #10)
  - [ ] Return 400 for non-zip files
  - [ ] Return 413 for files >500MB
  - [ ] Return 422 for corrupted/malformed zip files
  - [ ] Return 500 for extraction failures
  - [ ] Use descriptive error messages (per NFR-6)

- [ ] Add Unit Tests for Zip Extractor (AC: #4, #5, #6)
  - [ ] Test valid zip extraction (models + images)
  - [ ] Test nested directory scanning
  - [ ] Test file type filtering (accept whitelisted, ignore others)
  - [ ] Test hidden file exclusion (.DS_Store, .__MACOSX)
  - [ ] Test empty zip handling
  - [ ] Test corrupted zip handling

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

<!-- Path(s) to story context XML/JSON will be added here by context workflow -->

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

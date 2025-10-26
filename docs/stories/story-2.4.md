# Story 2.4: Implement File Selection and Bulk Import UI

Status: ContextReadyDraft

## Story

As an owner,
I want to review extracted files and select which ones to import,
so that I can exclude unwanted files (promos, alternate versions).

## Acceptance Criteria

1. UI displays all extracted files in grid layout with thumbnails
2. Image files show actual thumbnail previews
3. Model files (.stl, .3mf) show default 3D model icon placeholder
4. Each file has checkbox for selection (all selected by default)
5. Bulk actions: Select All, Deselect All
6. File info displayed: name, size, type
7. "Import Selected" button triggers bulk upload
8. Selected files uploaded to R2 and database records created (reuse Story 2.2 logic)
9. Progress indicator shows upload status (percentage-based per NFR-5)
10. Success confirmation lists imported files with thumbnails

## Tasks / Subtasks

- [ ] Create File Selection UI Component (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Design grid layout for file display (responsive: 4 cols desktop → 2 tablet → 1 mobile)
  - [ ] Implement thumbnail rendering for images (actual preview)
  - [ ] Add placeholder icon for model files (.stl, .3mf)
  - [ ] Add checkbox component for each file
  - [ ] Implement Select All / Deselect All bulk actions
  - [ ] Display file metadata (name, size, type)
  - [ ] Add file count summary (X files selected / Y total)

- [ ] Implement Bulk Import API Endpoint (AC: #7, #8)
  - [ ] Create POST /api/models/import-zip endpoint
  - [ ] Accept re-uploaded zip file + selected file paths JSON
  - [ ] Re-extract zip using client-extractor utility
  - [ ] Filter extracted files to selected paths only
  - [ ] Upload each selected file to R2 with proper headers
  - [ ] Create database records for each uploaded file (atomic per-file)
  - [ ] Return success/error status for each file
  - [ ] Handle partial failures gracefully (some files succeed, some fail)

- [ ] Integrate with Story 2.3 Extraction Flow (AC: #7)
  - [ ] Modify /test/upload-zip.tsx to show file selection UI after extraction
  - [ ] Keep extracted file list in component state
  - [ ] Pass selected file paths to import endpoint
  - [ ] Keep original zip file in browser memory for re-upload

- [ ] Implement Progress Tracking (AC: #9)
  - [ ] Add upload progress state (percentage, current file)
  - [ ] Display progress bar during import
  - [ ] Update progress as each file completes
  - [ ] Handle cancellation gracefully (if time permits, otherwise defer)

- [ ] Create Success Confirmation View (AC: #10)
  - [ ] Display list of successfully imported files
  - [ ] Show thumbnails for each imported file
  - [ ] Include file counts and total size imported
  - [ ] Provide "Import Another Zip" button to reset flow
  - [ ] Show error summary if any files failed

- [ ] Add Client-Side Validation and Error Handling
  - [ ] Validate at least one file selected before import
  - [ ] Display clear error messages for validation failures
  - [ ] Handle network errors during upload
  - [ ] Show per-file error details if upload fails
  - [ ] Add retry mechanism for failed uploads (optional)

- [ ] Write Unit Tests
  - [ ] Test file selection state management
  - [ ] Test Select All / Deselect All logic
  - [ ] Test filtering by file type
  - [ ] Test import API endpoint with mock files
  - [ ] Test partial failure scenarios
  - [ ] Test progress calculation logic

## Dev Notes

### Technical Approach

**CLIENT-SIDE ARCHITECTURE (Following Story 2.3 Pivot):**

Story 2.3 successfully moved zip extraction from server to client-side due to Cloudflare Workers memory constraints. Story 2.4 continues this client-first approach:

1. **Phase 1 (Story 2.3 - COMPLETE)**: Client extracts zip → displays file list
2. **Phase 2 (Story 2.4 - THIS STORY)**: User selects files → client uploads selected files

**Simplified Import Flow:**

Per tech spec lines 712-719, we use a simplified approach that avoids temporary storage complexity:

```
User uploads zip file
  → [CLIENT] Extract using client-extractor.ts (Story 2.3)
  → [CLIENT] Display file selection UI
  → [USER] Reviews and selects files
  → [CLIENT] Uploads selected files individually to import API
  → [SERVER] Creates R2 object + database record for each file
  → [CLIENT] Shows success confirmation
```

**Why Not Store Extracted Files:**

The tech spec identifies that Blob objects cannot be serialized for JSON responses. Two options exist:
1. **Simplified MVP Approach** (chosen): Keep zip in browser memory, re-extract selected files, upload individually
2. **Complex Approach**: Store extracted files in temporary R2 location with expiry

We choose option #1 because:
- Avoids temporary storage management complexity
- Browser memory can easily handle 500MB zips
- Re-extraction is fast (happens client-side)
- Cleaner separation: extraction (Story 2.3) vs import (Story 2.4)

**Reusing Story 2.2 Upload Logic:**

Per tech spec and AC#8, the import endpoint should reuse the atomic upload pattern from Story 2.2:
- Upload to R2 first (with proper content-type and content-disposition headers)
- Create database record second
- If DB fails, queue R2 deletion (per NFR-4 atomicity requirement)

**Per-File vs Batch Import:**

The implementation uploads files individually (not as a single atomic batch) because:
- Enables progress tracking per AC#9
- Allows partial success (some files import, some fail)
- Prevents all-or-nothing failures for large batches
- Each file is atomic (R2 + DB), but batch is not atomic

**Progress Indicator Requirements:**

Per NFR-5 and AC#9, the progress indicator must:
- Show percentage-based progress (e.g., "Importing 3/10 files...")
- Update as each file completes
- Display current file being uploaded
- Show total bytes uploaded / total bytes (optional enhancement)

### Architecture Constraints

**Cloudflare Workers Context:**

Per CLAUDE.md, the import API endpoint will run on Cloudflare Workers. Key considerations:
- Memory limit: 128MB per request (not an issue for individual file uploads)
- Execution time limit: 30 seconds for HTTP requests (CPU time, not wall-clock)
- R2 access: Via Cloudflare R2 bucket binding (configured in wrangler.jsonc)
- Database access: Via Prisma client targeting Xata PostgreSQL
- Environment variables: Accessed via `getContext('cloudflare').env`

**File Upload Pattern:**

Following Story 2.2 established pattern for R2 uploads:

```typescript
// Upload to R2 with explicit headers (per FR-16)
await bucket.put(r2Key, fileContent, {
  httpMetadata: {
    contentType: file.type || 'application/octet-stream',
    contentDisposition: `attachment; filename="${file.name}"`,
  },
})

// Construct R2 URL
const r2Url = `https://${bucket.name}.r2.cloudflarestorage.com/${r2Key}`

// Create database record (atomic operation per NFR-4)
const model = await prisma.model.create({
  data: {
    filename: file.name,
    r2Key: r2Key,
    r2Url: r2Url,
    fileSize: file.size,
    contentType: file.type,
  },
})
```

**Error Handling Strategy:**

Per NFR-6 (no stack traces exposed) and Story 2.2 patterns:
- Use `createErrorResponse()` utility for consistent error format
- Log full errors server-side with `logError()`
- Return sanitized error messages to client
- Provide specific error codes (e.g., 'R2_UPLOAD_FAILED', 'DB_CREATE_FAILED')
- For partial failures: return mixed success/error array, not throw exception

### UI/UX Considerations

**Visual Grid Layout:**

Per UX Principle 1 (visual-first browsing) and AC#1:
- Responsive grid: 4 columns desktop → 2 tablet → 1 mobile (per UX Principle 9)
- Thumbnail size: 200x200px minimum (consistent with Epic 5 Story 5.3)
- Hover effects: Enlarge thumbnail on hover
- Selection state: Visual indicator (border, checkmark overlay) when selected

**Thumbnail Display:**

- **Image files**: Show actual thumbnail preview using Blob URL (`URL.createObjectURL(blob)`)
- **Model files**: Show placeholder icon (generic 3D model icon)
- **Fallback**: If thumbnail fails to load, show placeholder

**File Metadata Display:**

Per AC#6, each file card shows:
- Filename (truncated if too long, full name in tooltip)
- File size (human-readable: KB, MB)
- File type badge (Model, Image)

**Bulk Actions:**

Per AC#5, provide convenience actions:
- "Select All" button (checks all checkboxes)
- "Deselect All" button (unchecks all checkboxes)
- File count summary: "15 files selected / 20 total"

**Progress Indicator:**

Per AC#9 and NFR-5:
- Percentage-based progress bar (0-100%)
- Current file name being uploaded
- Files completed / total files
- Estimated time remaining (optional enhancement)

**Success Confirmation:**

Per AC#10:
- Grid view of successfully imported files with thumbnails
- Summary: "Successfully imported 15 files (125 MB)"
- Error section (if any): "Failed to import 2 files" with details
- "Import Another Zip" button to restart flow

### Project Structure Notes

**New Files to Create:**

- `/src/routes/api/models/import-zip.ts` - Bulk import API endpoint
- `/src/components/FileSelectionGrid.tsx` - File selection UI component
- `/src/components/ImportProgress.tsx` - Progress indicator component
- `/src/components/ImportSuccess.tsx` - Success confirmation component
- `/src/__tests__/routes/api/models/import-zip.test.ts` - API endpoint tests
- `/src/__tests__/components/FileSelectionGrid.test.ts` - UI component tests

**Files to Modify:**

- `/src/routes/test/upload-zip.tsx` - Integrate file selection UI after extraction
- `/src/lib/zip/client-extractor.ts` - No changes, reuse as-is

**Alignment with Story 2.2:**

This story extends file upload infrastructure from Story 2.2:
- Reuses R2 upload pattern (bucket.put with headers)
- Follows same database creation pattern (Prisma model.create)
- Uses same error handling utilities (createErrorResponse, logError)
- Maintains same atomicity guarantees (R2 first, DB second)

**Key Difference from Story 2.2:**

- Story 2.2: Single file upload → immediate R2+DB
- Story 2.4: Multiple files (bulk) → loop over files → R2+DB per file
- Story 2.4: Progress tracking and partial failure handling

### References

**Source Documents:**

- [Source: docs/epics.md, Story 2.4, lines 269-294] - User story and acceptance criteria
- [Source: docs/tech-spec-epic-2.md, Story 2.4, lines 699-860] - Complete implementation specification
- [Source: docs/stories/story-2.2.md] - R2 upload pattern and atomicity requirements
- [Source: docs/stories/story-2.3.md] - Client-side extraction pattern and architectural pivot rationale
- [Source: CLAUDE.md, Cloudflare Workers Context, lines 90-152] - Environment access and bindings

**Technical Standards:**

- File types: .stl, .3mf (models), .png, .jpg, .jpeg (images) [epics.md line 285, FR-1]
- Max individual file size: 500MB (inherited from Story 2.3, NFR-2)
- Atomic operations: R2 first, DB second, cleanup on failure [tech-spec-epic-2.md, NFR-4]
- Error handling: No stack traces exposed [NFR-6]
- Progress indicator: Percentage-based [NFR-5]
- Logging: Structured with performance metrics [NFR-9]

**UI/UX Standards:**

- Visual-first grid layout [UX Principle 1]
- Responsive design (4→2→1 columns) [UX Principle 9]
- Thumbnail size: 200x200px minimum [Epic 5 Story 5.3]
- Progress feedback during operations [UX Principle 10]

**API Response Format:**

Per tech spec lines 840-860, success response (200) includes:

```json
{
  "imported": [
    {
      "id": "uuid",
      "filename": "baby-whale.stl",
      "r2Url": "https://...",
      "type": "model",
      "size": 1234567
    }
  ],
  "failed": [
    {
      "filename": "corrupted.stl",
      "error": "R2_UPLOAD_FAILED",
      "message": "Failed to upload file to storage"
    }
  ],
  "summary": {
    "total": 15,
    "succeeded": 13,
    "failed": 2,
    "totalBytes": 125829120
  }
}
```

**Error Response Codes:**

- 400: Missing required fields (file or selectedPaths)
- 413: Individual file too large (>500MB) - unlikely but possible
- 422: Zip re-extraction failed (file corrupted since extraction)
- 500: Unexpected server error (R2 unavailable, DB connection failed)

## Dev Agent Record

### Context Reference

- [Story Context XML](/home/taylor/projects/printfarm-manager/docs/story-context-2.2.4.xml) - Generated 2025-10-25

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

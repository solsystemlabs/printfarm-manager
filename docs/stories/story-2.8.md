# Story 2.8: Implement Slice CRUD Operations

Status: ContextReadyDraft

## Story

As an owner,
I want to view, edit, and delete slice records,
so that I can manage my slice configurations.

## Acceptance Criteria

1. Slice detail page displays: thumbnail, filename, size, upload date, associated models, products, filaments
2. Edit functionality: update slice name (if extraction didn't provide good name)
3. Delete functionality: hard delete with warnings per FR-17
4. Deletion prevented if slice is last/only slice for a product variant (per FR-7)
5. Deleting slice deletes associated R2 file (atomic operation per NFR-4)
6. Download button for slice file (sets proper headers per FR-16)
7. Slice list page shows all slices in visual grid
8. Metadata display section shows "Metadata not extracted yet" if metadataExtracted = false
9. Logs all CRUD operations with performance metrics per NFR-9
10. Slice detail enhanced in Epic 3 with curated metadata fields (layer height, temps, etc.)

## Tasks / Subtasks

- [ ] Implement Slice Detail API Endpoint (AC: #1, #6)
  - [ ] Create GET /api/slices/$sliceId endpoint
  - [ ] Fetch slice from database with Prisma
  - [ ] Include relationships: sliceModels, sliceFilaments, sliceVariants (Epic 3/4)
  - [ ] Return 404 SLICE_NOT_FOUND if slice doesn't exist
  - [ ] Return slice metadata: filename, size, URLs, dates, metadataExtracted flag
  - [ ] Include associated models list (id, filename)
  - [ ] Include associated filaments list (Epic 3)
  - [ ] Include associated product variants list (Epic 4)
  - [ ] Add structured logging

- [ ] Implement Slice Update API Endpoint (AC: #2)
  - [ ] Create PATCH /api/slices/$sliceId endpoint
  - [ ] Accept JSON body with updatable fields (filename, thumbnailUrl)
  - [ ] Validate input with Zod schema
  - [ ] Update database record with Prisma
  - [ ] Return updated slice metadata
  - [ ] Return 404 if slice not found
  - [ ] Add structured logging (slice_updated event)

- [ ] Implement Slice Delete API Endpoint (AC: #3, #4, #5, #9)
  - [ ] Create DELETE /api/slices/$sliceId endpoint
  - [ ] Check if slice is last for a product variant (Epic 4 constraint)
  - [ ] If last slice for variant, return 409 SLICE_REQUIRED error
  - [ ] If not last, delete from database (hard delete)
  - [ ] After DB delete, delete R2 file (bucket.delete)
  - [ ] Return 204 No Content on success
  - [ ] Return 404 if slice not found
  - [ ] Add structured logging (slice_deleted event)

- [ ] Implement Slice Detail Page UI (AC: #1, #2, #6, #8)
  - [ ] Create /slices/$sliceId route and component
  - [ ] Fetch slice data using React Query
  - [ ] Display thumbnail (or placeholder if null)
  - [ ] Display metadata: filename, size, upload date
  - [ ] Show metadataExtracted flag: "Metadata not extracted yet" if false
  - [ ] Display associated models list with links
  - [ ] Display associated filaments list with AMS slots (Epic 3)
  - [ ] Display associated product variants list (Epic 4)
  - [ ] Add Download button (links to r2Url with proper headers)
  - [ ] Add Edit button (inline edit or modal)
  - [ ] Add Delete button (triggers confirmation modal)
  - [ ] Show loading state while fetching
  - [ ] Show error state if fetch fails

- [ ] Implement Edit Functionality (AC: #2)
  - [ ] Add inline edit for filename (or edit modal)
  - [ ] Add thumbnail upload/replace button (Story 2.6 integration)
  - [ ] Validate filename input (not empty, length limits)
  - [ ] Call PATCH endpoint on save
  - [ ] Update UI optimistically or after success
  - [ ] Show success/error toast notifications
  - [ ] Cancel button reverts changes

- [ ] Implement Delete Confirmation Modal (AC: #4)
  - [ ] Create confirmation modal component (reuse from Story 2.7)
  - [ ] Show warning if slice is last for variant: "Cannot delete last slice for product variant"
  - [ ] Prevent deletion if last (show 409 error message)
  - [ ] Show delete button (red, prominent)
  - [ ] Show cancel button
  - [ ] Display loading state during deletion
  - [ ] Display error message if deletion fails
  - [ ] Redirect to slices list on successful deletion

- [ ] Implement Download Button with Proper Headers (AC: #6)
  - [ ] Download button links to r2Url
  - [ ] Verify R2 URL has content-disposition: attachment header (set in Story 2.5)
  - [ ] Test download forces file download (not inline view)
  - [ ] Filename in download matches original slice filename
  - [ ] Test download works on mobile browsers (UX Principle 9)

- [ ] Implement Slice List Page UI (AC: #7)
  - [ ] Create /slices route and component
  - [ ] Fetch all slices using React Query
  - [ ] Display slices in responsive grid (4→2→1 columns)
  - [ ] Each card shows: thumbnail, filename, file size, metadata status
  - [ ] Show metadata badge: "Metadata Extracted" or "Pending"
  - [ ] Click card to navigate to detail page
  - [ ] Show placeholder image when thumbnailUrl is null
  - [ ] Add "Upload New Slice" button (links to upload page)
  - [ ] Implement infinite scroll or pagination (if needed)
  - [ ] Show loading skeleton during fetch
  - [ ] Show empty state if no slices: "No slices yet. Upload your first slice!"

- [ ] Prepare for Epic 3 Metadata Enhancement (AC: #10)
  - [ ] Add metadata display section to detail page (shows "Not extracted yet")
  - [ ] Plan UI layout for curated fields (layer height, temps, etc.)
  - [ ] Add placeholder for "Show All Metadata" toggle (Epic 3)
  - [ ] Document integration points for Epic 3 Story 3.6 (metadata display)

- [ ] Write Unit Tests
  - [ ] Test GET /api/slices/$sliceId returns slice data
  - [ ] Test GET /api/slices/$sliceId returns 404 for invalid ID
  - [ ] Test GET includes associated models
  - [ ] Test PATCH /api/slices/$sliceId updates filename
  - [ ] Test PATCH returns 404 for invalid ID
  - [ ] Test DELETE /api/slices/$sliceId deletes slice and R2 file
  - [ ] Test DELETE returns 409 if slice is last for variant
  - [ ] Test DELETE returns 404 for invalid ID
  - [ ] Test DELETE logs slice_deleted event
  - [ ] Test slice detail page renders correctly
  - [ ] Test download button has correct headers
  - [ ] Test delete confirmation modal prevents accidental deletion
  - [ ] Test slice list page displays grid correctly

## Dev Notes

### Technical Approach

**CRUD Operations for Slices:**

Similar to Story 2.7 (Model CRUD) but for slices:
- **Create**: Already implemented in Story 2.5 (upload endpoint)
- **Read**: GET /api/slices/$sliceId (detail view) + GET /api/slices (list view)
- **Update**: PATCH /api/slices/$sliceId (edit filename, replace thumbnail)
- **Delete**: DELETE /api/slices/$sliceId (hard delete with R2 cleanup)

**Key Differences from Story 2.7 (Model CRUD):**

| Aspect | Models (Story 2.7) | Slices (Story 2.8) |
|--------|-------------------|-------------------|
| Metadata | No metadata | metadataExtracted flag, Epic 3 will populate |
| Relationships | → slices | → models, filaments (Epic 3), variants (Epic 4) |
| Deletion constraint | Prevent if used in slices | Prevent if last slice for variant (Epic 4) |
| Download headers | attachment | attachment (force download, not view) |
| UI complexity | Simple | Moderate (metadata display in Epic 3) |

**Deletion Prevention (Epic 4 Constraint):**

Per AC#4 and FR-7, slices cannot be deleted if they're the last/only slice for a product variant:

```typescript
// Check if slice is last for any variant
const slice = await prisma.slice.findUnique({
  where: { id: sliceId },
  include: { sliceVariants: { include: { variant: true } } }
})

for (const sv of slice.sliceVariants) {
  const variantSliceCount = await prisma.sliceVariant.count({
    where: { variantId: sv.variantId }
  })

  if (variantSliceCount === 1) {
    return createErrorResponse(
      new Error('Cannot delete last slice for product variant'),
      409,
      'SLICE_REQUIRED'
    )
  }
}
```

**Rationale**: Product variants must have at least one slice (recipe) to be valid. Deleting the last slice would leave the variant without a printable configuration.

**MVP Simplification**: This constraint is deferred to Epic 4 (when product variants are implemented). Story 2.8 includes the deletion endpoint but skips the variant check until Epic 4.

**Metadata Display (Epic 3 Integration):**

Per AC#8 and AC#10, slice detail page prepares for Epic 3 metadata:

```typescript
// Story 2.8 (MVP): Show metadata status
if (slice.metadataExtracted) {
  return "Metadata extracted (details in Epic 3)"
} else {
  return "Metadata not extracted yet"
}

// Epic 3 Story 3.6 will replace with:
if (slice.metadataExtracted) {
  return <CuratedMetadataDisplay slice={slice} />
} else {
  return "Metadata extraction pending"
}
```

**Download Button Headers:**

Per AC#6 and FR-16, slice downloads must use `attachment` disposition:

```typescript
// Story 2.5 already sets headers during upload:
await bucket.put(r2Key, file, {
  httpMetadata: {
    contentType: file.type || 'application/octet-stream',
    contentDisposition: `attachment; filename="${file.name}"`,
  },
})

// Story 2.8 UI just links to r2Url:
<a href={slice.r2Url} download>Download Slice</a>
```

The `attachment` disposition forces browser to download (not display inline), which is correct for .gcode/.gcode.3mf files.

**Hard Delete Pattern (Same as Story 2.7):**

```typescript
// 1. Delete from database first
await prisma.slice.delete({ where: { id: sliceId } })

// 2. Queue R2 deletion after DB commit
await bucket.delete(slice.r2Key)

// If R2 delete fails, orphaned file cleaned up in storage audit
// If DB delete fails, slice still exists (consistent state)
```

### UI/UX Considerations

**Slice Detail Page Layout:**

Per AC#1 and similar to Story 2.7 model detail:

```
┌─────────────────────────────────────┐
│  baby-whale-red.gcode.3mf           │
│  Uploaded Oct 25, 2025 11:00 AM     │
├─────────────────────────────────────┤
│                                     │
│   [Thumbnail 256x256]               │
│                                     │
│  File Size: 25.3 MB                 │
│  Metadata: ⚠️ Not extracted yet     │
│  Used in Models: 1                  │
│  Used in Products: 2                │
│                                     │
│  [Download Slice]  [Delete Slice]  │
│                                     │
├─────────────────────────────────────┤
│  Associated Models:                 │
│  - baby-whale.stl                   │
│                                     │
│  Filaments (Epic 3):                │
│  - Slot 1: Red PLA (Bambu Lab)      │
│  - Slot 2: White PLA (Bambu Lab)    │
└─────────────────────────────────────┘
```

**Metadata Status Badge:**

Per AC#8, clearly indicate metadata extraction status:
- ✅ "Metadata Extracted" (green badge) - if metadataExtracted = true
- ⚠️ "Metadata Pending" (yellow badge) - if metadataExtracted = false
- Link to Epic 3 documentation explaining what metadata extraction provides

**Slice List Page Grid:**

Per AC#7 and UX Principle 1 (visual-first browsing):

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ [Thumb]      │  │ [Thumb]      │  │ [Thumb]      │
│ baby-whale-  │  │ octopus-     │  │ dragon-      │
│ red.gcode.3mf│  │ blue.gcode   │  │ green.gcode  │
│ 25.3 MB      │  │ 18.7 MB      │  │ 42.1 MB      │
│ ✅ Metadata  │  │ ⚠️ Pending   │  │ ✅ Metadata  │
└──────────────┘  └──────────────┘  └──────────────┘
```

- Responsive grid: 4 columns desktop → 2 tablet → 1 mobile
- Metadata badge shows extraction status at a glance
- Thumbnail or placeholder (generic gcode icon)
- Filename truncated with tooltip showing full name

**Download Button Implementation:**

Per AC#6 and FR-16, download must work correctly:

```typescript
// UI component
<a
  href={slice.r2Url}
  download={slice.filename}
  className="px-4 py-2 bg-blue-600 text-white rounded"
>
  Download Slice
</a>

// R2 headers (set in Story 2.5):
// content-disposition: attachment; filename="baby-whale-red.gcode.3mf"
// → Forces download instead of inline view
```

Test on mobile browsers (iOS Safari, Android Chrome) to ensure download works correctly.

### Epic 3 Integration Points

**Metadata Display (Story 3.6):**

Story 2.8 prepares UI structure for Epic 3 metadata:

**MVP (Story 2.8):**
```typescript
<div className="metadata-section">
  {slice.metadataExtracted ? (
    <p>✅ Metadata extracted (details coming in Epic 3)</p>
  ) : (
    <p>⚠️ Metadata not extracted yet</p>
  )}
</div>
```

**Epic 3 Story 3.6 Enhancement:**
```typescript
<div className="metadata-section">
  {slice.metadataExtracted ? (
    <>
      <h3>Print Settings</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>Layer Height: {slice.layerHeight}mm</div>
        <div>Nozzle Temp: {slice.nozzleTemp}°C</div>
        <div>Bed Temp: {slice.bedTemp}°C</div>
        <div>Print Speed: {slice.printSpeed}mm/s</div>
        <div>Infill: {slice.infillPercent}%</div>
        <div>Supports: {slice.supportsEnabled ? 'Yes' : 'No'}</div>
      </div>
      <button onClick={() => setShowAllMetadata(true)}>
        Show All Metadata
      </button>
    </>
  ) : (
    <p>⚠️ Metadata extraction pending</p>
  )}
</div>
```

**Filament Display (Story 3.3/3.4):**

Epic 3 will populate `sliceFilaments` junction table:

```typescript
<div className="filaments-section">
  <h3>Filaments Required</h3>
  {slice.sliceFilaments.map(sf => (
    <div key={sf.id}>
      Slot {sf.amsSlotIndex}: {sf.filament.colorName} {sf.filament.materialType} ({sf.filament.brand})
    </div>
  ))}
</div>
```

**Product Variant Display (Epic 4):**

Epic 4 will show which product variants use this slice:

```typescript
<div className="products-section">
  <h3>Used in Products</h3>
  {slice.sliceVariants.map(sv => (
    <div key={sv.id}>
      <a href={`/products/${sv.variant.productId}`}>
        {sv.variant.product.name} - {sv.variant.name}
      </a>
    </div>
  ))}
</div>
```

### Project Structure Notes

**New Files to Create:**

- `/src/routes/api/slices/$sliceId.ts` - Slice CRUD API endpoints (GET, PATCH, DELETE)
- `/src/routes/slices/$sliceId.tsx` - Slice detail page UI
- `/src/routes/slices/index.tsx` - Slice list page UI
- `/src/components/SliceCard.tsx` - Reusable slice card for grid display
- `/src/components/MetadataStatusBadge.tsx` - Metadata extraction status indicator
- `/src/__tests__/routes/api/slices/$sliceId.test.ts` - API endpoint tests
- `/src/__tests__/routes/slices/$sliceId.test.tsx` - UI component tests

**Files to Modify:**

- `/src/routes/__root.tsx` - Add navigation link to /slices (if not already present)
- Slice detail page (this story) - Add thumbnail upload button (Story 2.6 integration)

**Reusable Components:**

- `DeleteConfirmModal` from Story 2.7 - Reuse for slice deletion
- `ThumbnailUpload` from Story 2.6 - Reuse for slice thumbnail replace

### Performance Considerations

**Database Queries:**

Similar to Story 2.7, optimize Prisma queries:

```typescript
const slice = await prisma.slice.findUnique({
  where: { id: sliceId },
  include: {
    sliceModels: {
      include: {
        model: {
          select: { id: true, filename: true }
        }
      }
    },
    // Epic 3: Add filament relationships
    // sliceFilaments: { include: { filament: true } }

    // Epic 4: Add variant relationships
    // sliceVariants: { include: { variant: { include: { product: true } } } }
  }
})
```

**Metadata Query Optimization:**

Epic 3 will add curated metadata fields (layerHeight, nozzleTemp, etc.) as denormalized columns for fast queries. Story 2.8 just displays `metadataExtracted` boolean flag.

### Error Handling

**HTTP Status Codes:**

Following Story 2.7 patterns:

| Code | Error Code | Meaning |
|------|------------|---------|
| 200 | - | GET success (slice found) |
| 204 | - | DELETE success (no content) |
| 404 | SLICE_NOT_FOUND | Slice ID doesn't exist |
| 409 | SLICE_REQUIRED | Cannot delete (last for variant) |
| 422 | VALIDATION_FAILED | Invalid input (PATCH) |
| 500 | FETCH_FAILED | Database error (GET) |
| 500 | UPDATE_FAILED | Database error (PATCH) |
| 500 | DELETE_FAILED | Database or R2 error (DELETE) |

**Deletion Prevention Error (Epic 4):**

```json
{
  "error": {
    "code": "SLICE_REQUIRED",
    "message": "Cannot delete last slice for product variant 'Baby Whale - Red'",
    "status": 409
  }
}
```

### References

**Source Documents:**

- [Source: docs/epics.md, Story 2.8, lines 367-388] - User story and acceptance criteria
- [Source: docs/tech-spec-epic-2.md, Story 2.8, lines 1724-1850] - Implementation specification
- [Source: docs/PRD.md, FR-7] - Product variant must have at least one slice
- [Source: docs/PRD.md, FR-16] - Download headers (content-disposition: attachment)
- [Source: docs/PRD.md, FR-17] - Hard delete requirement
- [Source: docs/stories/story-2.7.md] - Model CRUD pattern (template for slices)
- [Source: docs/stories/story-2.5.md] - Slice upload (sets R2 headers)

**Technical Standards:**

- Hard delete: Physical removal from database and R2 [FR-17]
- Atomic operations: Database first, R2 cleanup second [NFR-4]
- Deletion prevention: 409 conflict if last slice for variant [FR-7]
- Download headers: content-disposition: attachment [FR-16]
- Visual grid: 4→2→1 responsive columns [UX Principle 1]
- Error handling: Sanitized messages, no stack traces [NFR-6]
- Logging: Structured events with performance metrics [NFR-9]

**API Response Formats:**

**GET /api/slices/$sliceId** (200 success):
```json
{
  "id": "uuid",
  "filename": "baby-whale-red.gcode.3mf",
  "r2Url": "https://...",
  "thumbnailUrl": "https://...",
  "fileSize": 26542080,
  "contentType": "application/octet-stream",
  "metadataExtracted": false,
  "createdAt": "2025-10-25T11:00:00Z",
  "updatedAt": "2025-10-25T11:30:00Z",
  "models": [
    { "id": "uuid", "filename": "baby-whale.stl" }
  ]
}
```

**DELETE /api/slices/$sliceId** (409 conflict):
```json
{
  "error": {
    "code": "SLICE_REQUIRED",
    "message": "Cannot delete last slice for product variant",
    "status": 409
  }
}
```

## Dev Agent Record

### Context Reference

- [Story Context XML](/home/taylor/projects/printfarm-manager/docs/story-context-2.2.8.xml) - Generated 2025-10-25

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

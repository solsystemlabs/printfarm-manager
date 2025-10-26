# Story 2.7: Implement Model CRUD Operations

Status: ContextReadyDraft

## Story

As an owner,
I want to view, edit, and delete model records,
so that I can manage my model catalog over time.

## Acceptance Criteria

1. Model detail page displays: thumbnail, filename, size, upload date, associated slices, products
2. Edit functionality: update model name, replace thumbnail
3. Delete functionality: hard delete per FR-17 (no soft delete in MVP)
4. Deletion warning shows related entities: "This model is used in 3 slices and 2 products"
5. Deleting model deletes associated R2 file (atomic operation per NFR-4)
6. Deletion breaks relationships - slices/products show warning "Missing model: [name]"
7. Model list page shows all models in visual grid with thumbnails and names per UX Principle 1
8. Download button for model file (sets proper headers per FR-16)
9. Deletion prevented if model used in slices (409 conflict error)
10. Logs all CRUD operations with performance metrics per NFR-9

## Tasks / Subtasks

- [ ] Implement Model Detail API Endpoint (AC: #1, #8)
  - [ ] Create GET /api/models/$modelId endpoint
  - [ ] Fetch model from database with Prisma
  - [ ] Include relationships: sliceModels, products (Epic 4)
  - [ ] Return 404 MODEL_NOT_FOUND if model doesn't exist
  - [ ] Return model metadata: filename, size, URLs, dates
  - [ ] Include associated slices list (id, filename)
  - [ ] Include associated products list (id, name) - Epic 4
  - [ ] Add structured logging

- [ ] Implement Model Update API Endpoint (AC: #2)
  - [ ] Create PATCH /api/models/$modelId endpoint
  - [ ] Accept JSON body with updatable fields (filename, thumbnailUrl)
  - [ ] Validate input with Zod schema
  - [ ] Update database record with Prisma
  - [ ] Return updated model metadata
  - [ ] Return 404 if model not found
  - [ ] Add structured logging (model_updated event)

- [ ] Implement Model Delete API Endpoint (AC: #3, #4, #5, #9, #10)
  - [ ] Create DELETE /api/models/$modelId endpoint
  - [ ] Check if model used in slices (count sliceModels)
  - [ ] If used, return 409 MODEL_IN_USE error with count
  - [ ] If not used, delete from database (hard delete)
  - [ ] After DB delete, delete R2 file (bucket.delete)
  - [ ] Return 204 No Content on success
  - [ ] Return 404 if model not found
  - [ ] Add structured logging (model_deleted event)

- [ ] Implement Model Detail Page UI (AC: #1, #2, #8)
  - [ ] Create /models/$modelId route and component
  - [ ] Fetch model data using React Query
  - [ ] Display thumbnail (or placeholder if null)
  - [ ] Display metadata: filename, size, upload date
  - [ ] Display associated slices list with links
  - [ ] Display associated products list with links (Epic 4)
  - [ ] Add Download button (links to r2Url)
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

- [ ] Implement Delete Confirmation Modal (AC: #4, #9)
  - [ ] Create confirmation modal component
  - [ ] Show warning if model used in slices: "This model is used in X slices"
  - [ ] Prevent deletion if used (show 409 error message)
  - [ ] Show delete button (red, prominent)
  - [ ] Show cancel button
  - [ ] Display loading state during deletion
  - [ ] Display error message if deletion fails
  - [ ] Redirect to models list on successful deletion

- [ ] Implement Model List Page UI (AC: #7)
  - [ ] Create /models route and component
  - [ ] Fetch all models using React Query
  - [ ] Display models in responsive grid (4→2→1 columns)
  - [ ] Each card shows: thumbnail, filename, file size
  - [ ] Click card to navigate to detail page
  - [ ] Show placeholder image when thumbnailUrl is null
  - [ ] Add "Upload New Model" button (links to upload page)
  - [ ] Implement infinite scroll or pagination (if needed)
  - [ ] Show loading skeleton during fetch
  - [ ] Show empty state if no models: "No models yet. Upload your first model!"

- [ ] Handle Broken Relationships (AC: #6) - DEFERRED TO EPIC 4
  - [ ] Update slice/product detail pages to handle missing models
  - [ ] Show warning: "Missing model: [name]" if model deleted
  - [ ] Provide UI to reassign or remove broken relationship
  - [ ] NOTE: Relationship handling deferred to Epic 4 (Products & Variants)

- [ ] Write Unit Tests
  - [ ] Test GET /api/models/$modelId returns model data
  - [ ] Test GET /api/models/$modelId returns 404 for invalid ID
  - [ ] Test GET includes associated slices
  - [ ] Test PATCH /api/models/$modelId updates filename
  - [ ] Test PATCH returns 404 for invalid ID
  - [ ] Test DELETE /api/models/$modelId deletes model and R2 file
  - [ ] Test DELETE returns 409 if model used in slices
  - [ ] Test DELETE returns 404 for invalid ID
  - [ ] Test DELETE logs model_deleted event
  - [ ] Test model detail page renders correctly
  - [ ] Test delete confirmation modal prevents accidental deletion
  - [ ] Test model list page displays grid correctly

## Dev Notes

### Technical Approach

**CRUD Operations Overview:**

This story implements Create, Read, Update, Delete operations for models:
- **Create**: Already implemented in Story 2.2 (upload endpoint)
- **Read**: GET /api/models/$modelId (detail view) + GET /api/models (list view)
- **Update**: PATCH /api/models/$modelId (edit filename, replace thumbnail)
- **Delete**: DELETE /api/models/$modelId (hard delete with R2 cleanup)

**Hard Delete vs Soft Delete:**

Per FR-17 and epics.md AC#3, MVP uses **hard delete** (physical removal):
- Delete record from database permanently
- Delete associated R2 file
- Relationships break (slices/products show "Missing model" warning)
- No "trash" or "archive" functionality in MVP
- Soft delete deferred to Phase 2/3 per NFR-11

**Rationale**: Hard delete is simpler for MVP. Soft delete adds complexity:
- Requires `deletedAt` timestamp column
- Queries must filter `WHERE deletedAt IS NULL`
- R2 files remain (storage costs accumulate)
- UI needs "Show Deleted" toggle

**Deletion Atomicity Pattern:**

Per NFR-4 and tech spec lines 1526-1532, deletion follows atomic pattern:

```typescript
// 1. Delete from database first
await prisma.model.delete({ where: { id: modelId } })

// 2. Queue R2 deletion after DB commit (eventual consistency)
await bucket.delete(model.r2Key)

// If R2 delete fails, it's acceptable (orphaned R2 files cleaned up manually)
// If DB delete fails, R2 file remains (consistent state - model still exists)
```

**Why DB First:**
- Prevents "dangling references" (DB points to non-existent R2 file)
- If R2 delete fails, orphaned file can be cleaned up later (storage audit)
- If DB delete fails, entire operation failed (model still exists)

**Alternative Order** (R2 → DB):
- ❌ If R2 succeeds but DB fails → DB points to deleted file (broken state)
- ❌ User sees model in catalog but can't download it

**Deletion Prevention (409 Conflict):**

Per AC#9 and tech spec lines 1516-1524, prevent deletion if model used:

```typescript
const model = await prisma.model.findUnique({
  where: { id: modelId },
  include: { sliceModels: true }
})

if (model.sliceModels.length > 0) {
  return createErrorResponse(
    new Error(`Cannot delete model used in ${model.sliceModels.length} slice(s)`),
    409,
    'MODEL_IN_USE'
  )
}
```

**Rationale**: Deleting referenced models breaks data integrity. Better to:
1. Show warning to user
2. Require user to delete slices first, OR
3. Reassign slices to different model

MVP implements option 1 (prevention). Phase 2 may add cascading delete options.

**Edit Functionality:**

Per AC#2, edit operations are limited in MVP:
- ✅ Update filename (simple text edit)
- ✅ Replace thumbnail (upload new image via Story 2.6 endpoint)
- ❌ Replace model file (requires full re-upload - complex, deferred)
- ❌ Edit metadata (no metadata for models in MVP - deferred to Epic 3)

**Filename Edit Implementation:**

```typescript
// PATCH /api/models/$modelId
const UpdateModelSchema = z.object({
  filename: z.string().min(1).max(255).optional(),
  thumbnailUrl: z.string().url().optional(),
})

const updated = await prisma.model.update({
  where: { id: modelId },
  data: validatedData,
})
```

**Thumbnail Replace Implementation:**

Integration with Story 2.6 thumbnail upload:
1. User clicks "Replace Thumbnail" button
2. File input opens
3. User selects new image
4. Call POST /api/images/upload (Story 2.6)
5. Get new R2 URL
6. Call PATCH /api/models/$modelId with new thumbnailUrl
7. Old thumbnail remains in R2 (cleanup deferred to storage audit)

### UI/UX Considerations

**Model Detail Page Layout:**

Per AC#1 and tech spec lines 1604-1707:

```
┌─────────────────────────────────────┐
│  Baby Whale Model                   │
│  Uploaded Oct 25, 2025 10:30 AM     │
├─────────────────────────────────────┤
│                                     │
│   [Thumbnail 256x256]               │
│                                     │
│  File Size: 12.5 MB                 │
│  Used in Slices: 3                  │
│  Used in Products: 1                │
│                                     │
│  [Download File]  [Delete Model]   │
│                                     │
├─────────────────────────────────────┤
│  Used in Slices:                    │
│  - baby-whale-red.gcode.3mf        │
│  - baby-whale-blue.gcode.3mf       │
│  - baby-whale-green.gcode.3mf      │
└─────────────────────────────────────┘
```

**Model List Page Grid:**

Per AC#7 and UX Principle 1 (visual-first browsing):

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ [Thumb]  │  │ [Thumb]  │  │ [Thumb]  │  │ [Thumb]  │
│ Baby     │  │ Octopus  │  │ Dragon   │  │ Castle   │
│ Whale    │  │          │  │          │  │          │
│ 12.5 MB  │  │ 8.2 MB   │  │ 45.6 MB  │  │ 23.1 MB  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

- Responsive grid: 4 columns desktop → 2 tablet → 1 mobile
- Thumbnail size: 200x200px minimum (consistent with Epic 5 Story 5.3)
- Placeholder image when thumbnailUrl is null
- Hover effect: slight scale or shadow
- Click anywhere on card → navigate to detail page

**Delete Confirmation Modal:**

Per AC#4 and tech spec lines 1671-1706:

```
┌───────────────────────────────────┐
│  Confirm Deletion                 │
├───────────────────────────────────┤
│  Are you sure you want to delete  │
│  "baby-whale.stl"?                │
│                                   │
│  ⚠️ Warning: This model is used   │
│  in 3 slices. Deletion will       │
│  break those relationships.       │
│                                   │
│  [Delete]  [Cancel]               │
└───────────────────────────────────┘
```

- Warning text in red if model used
- Delete button disabled if 409 error (MODEL_IN_USE)
- Show error message from API if deletion fails
- Cancel button closes modal without action

### Architecture Constraints

**TanStack Router Dynamic Routes:**

Per tech spec and TanStack Start patterns, use dynamic route parameters:

```typescript
// API route
export const Route = createFileRoute('/api/models/$modelId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const modelId = params.modelId // UUID from URL
        // ...
      },
    },
  },
})

// UI route
export const Route = createFileRoute('/models/$modelId')({
  component: ModelDetailPage,
})

function ModelDetailPage() {
  const { modelId } = Route.useParams() // Type-safe access
  // ...
}
```

**Relationship Loading (Prisma Includes):**

Per AC#1 and tech spec lines 1454-1465, load related entities:

```typescript
const model = await prisma.model.findUnique({
  where: { id: modelId },
  include: {
    sliceModels: {
      include: {
        slice: {
          select: {
            id: true,
            filename: true,
          },
        },
      },
    },
    // Epic 4: Add product relationships
    // productVariantModels: { ... }
  },
})
```

**Many-to-Many Relationship Pattern:**

Models ↔ Slices is many-to-many via `slice_models` junction table (Epic 4):
- One model can be used in multiple slices (e.g., single .stl file, multiple print configs)
- One slice can reference multiple models (multi-part prints)

Story 2.7 displays the "one model → many slices" direction.
Epic 4 will fully implement the junction table and relationships.

**React Query Integration:**

Per tech spec lines 1575-1594, use React Query for data fetching:

```typescript
const { data, isLoading, error } = useQuery<ModelDetail>({
  queryKey: ['model', modelId],
  queryFn: () => fetch(`/api/models/${modelId}`).then(r => r.json()),
})

const deleteMutation = useMutation({
  mutationFn: async () => {
    const response = await fetch(`/api/models/${modelId}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('Delete failed')
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['models'] })
    navigate('/models')
  },
})
```

Benefits:
- Automatic caching (queryKey)
- Loading/error states built-in
- Optimistic updates (mutations)
- Cache invalidation (refetch on updates)

### Error Handling

**HTTP Status Codes:**

Following Story 2.2/2.5 patterns:

| Code | Error Code | Meaning |
|------|------------|---------|
| 200 | - | GET success (model found) |
| 204 | - | DELETE success (no content) |
| 404 | MODEL_NOT_FOUND | Model ID doesn't exist |
| 409 | MODEL_IN_USE | Cannot delete (used in slices) |
| 422 | VALIDATION_FAILED | Invalid input (PATCH) |
| 500 | FETCH_FAILED | Database error (GET) |
| 500 | UPDATE_FAILED | Database error (PATCH) |
| 500 | DELETE_FAILED | Database or R2 error (DELETE) |

**User-Facing Error Messages:**

Per NFR-6, sanitize errors for users:

```typescript
// ❌ DON'T: Expose technical details
"Prisma error: Unique constraint violation on models.filename"

// ✅ DO: User-friendly message
"A model with that name already exists. Please choose a different name."
```

**Error Logging:**

Per NFR-9, log full details server-side:

```typescript
try {
  await prisma.model.delete({ where: { id: modelId } })
} catch (error) {
  logError('model_delete_failed', error as Error, {
    model_id: modelId,
    filename: model.filename,
  })
  return createErrorResponse(
    error as Error,
    500,
    'DELETE_FAILED'
  )
}
```

### Integration Points

**Story 2.6 Integration (Thumbnail Replace):**

Model detail page includes thumbnail upload functionality from Story 2.6:
- "Replace Thumbnail" button → file input
- Selected image → POST /api/images/upload (Story 2.6 endpoint)
- Returns R2 URL → PATCH /api/models/$modelId
- Updated thumbnailUrl displayed immediately

**Epic 4 Integration (Product Relationships):**

Per AC#1 and AC#4, model detail shows associated products:
- Epic 4 Story 4.4 implements multi-model slice support
- `slice_models` junction table links models ↔ slices
- Model detail page displays reverse relationship: "Used in X slices"
- Deletion warning includes: "Used in Y products"

**MVP Scope**: Show slice count only (products deferred to Epic 4)

### Project Structure Notes

**New Files to Create:**

- `/src/routes/api/models/$modelId.ts` - Model CRUD API endpoints (GET, PATCH, DELETE)
- `/src/routes/models/$modelId.tsx` - Model detail page UI
- `/src/routes/models/index.tsx` - Model list page UI
- `/src/components/ModelCard.tsx` - Reusable model card for grid display
- `/src/components/DeleteConfirmModal.tsx` - Reusable delete confirmation modal
- `/src/__tests__/routes/api/models/$modelId.test.ts` - API endpoint tests
- `/src/__tests__/routes/models/$modelId.test.tsx` - UI component tests

**Files to Modify:**

- `/src/routes/__root.tsx` - Add navigation link to /models (if not already present)
- Model detail page (this story) - Add thumbnail upload button (Story 2.6 integration)

**Alignment with Epic 4:**

Story 2.7 provides foundation for Epic 4 product/variant relationships:
- Model CRUD operations established
- Relationship display patterns (model → slices) reusable for products
- Deletion prevention pattern (409 conflict) reusable for cascading deletes

### Performance Considerations

**Database Queries:**

Optimize Prisma queries with selective includes:

```typescript
// ❌ DON'T: Load all slice data
include: { sliceModels: { include: { slice: true } } }

// ✅ DO: Load only needed fields
include: {
  sliceModels: {
    include: {
      slice: {
        select: { id: true, filename: true }
      }
    }
  }
}
```

**Grid Pagination:**

Per NFR-11 and Epic 5 Story 5.3, pagination deferred unless needed:
- MVP: Load all models (acceptable for <1000 models)
- If performance degrades: Implement infinite scroll or pagination
- React Query handles caching automatically

**Logging Performance:**

Per NFR-9, log operation duration:

```typescript
const startTime = Date.now()
const model = await prisma.model.findUnique({ ... })
log('model_fetched', {
  model_id: modelId,
  duration_ms: Date.now() - startTime,
})
```

### References

**Source Documents:**

- [Source: docs/epics.md, Story 2.7, lines 344-364] - User story and acceptance criteria
- [Source: docs/tech-spec-epic-2.md, Story 2.7, lines 1423-1722] - Complete implementation specification
- [Source: docs/PRD.md, FR-17] - Hard delete requirement (no soft delete in MVP)
- [Source: docs/PRD.md, NFR-4] - Atomic operation requirements (R2 + DB)
- [Source: docs/stories/story-2.6.md] - Thumbnail upload integration

**Technical Standards:**

- Hard delete: Physical removal from database and R2 [FR-17]
- Atomic operations: Database first, R2 cleanup second [NFR-4]
- Deletion prevention: 409 conflict if model used [AC#9]
- Visual grid: 4→2→1 responsive columns [UX Principle 1]
- Error handling: Sanitized messages, no stack traces [NFR-6]
- Logging: Structured events with performance metrics [NFR-9]

**API Response Formats:**

**GET /api/models/$modelId** (200 success):
```json
{
  "id": "uuid",
  "filename": "baby-whale.stl",
  "r2Url": "https://...",
  "thumbnailUrl": "https://...",
  "fileSize": 12582912,
  "contentType": "application/octet-stream",
  "createdAt": "2025-10-25T10:30:00Z",
  "updatedAt": "2025-10-25T11:45:00Z",
  "slices": [
    { "id": "uuid", "filename": "baby-whale-red.gcode.3mf" }
  ]
}
```

**DELETE /api/models/$modelId** (204 success):
- No content in response body
- Returns 204 No Content status

**DELETE /api/models/$modelId** (409 conflict):
```json
{
  "error": {
    "code": "MODEL_IN_USE",
    "message": "Cannot delete model used in 3 slice(s)",
    "status": 409
  }
}
```

## Dev Agent Record

### Context Reference

- [Story Context XML](/home/taylor/projects/printfarm-manager/docs/story-context-2.2.7.xml) - Generated 2025-10-25

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

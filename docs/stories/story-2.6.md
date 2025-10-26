# Story 2.6: Implement Thumbnail Handling

Status: ContextReadyDraft

## Story

As an owner,
I want thumbnails automatically extracted and resized from uploaded files,
so that my catalog has consistent visual presentation.

## Acceptance Criteria

1. Image files (.png, .jpg) uploaded as thumbnails during zip extraction
2. Oversized images (>2MB or >1024x1024) automatically resized to fit limits per NFR-2
3. Resizing preserves aspect ratio, uses high-quality scaling
4. If resizing fails or is complex, show oversized image as unselectable with warning per FR-3
5. Default placeholder image used when no thumbnail available
6. Thumbnails extracted from .gcode.3mf files (embedded in slice file) - defer extraction logic to Epic 3
7. Manual thumbnail upload/replace supported via UI (owner can change thumbnail anytime)
8. Resized images converted to JPEG format (85% quality) for consistency
9. Images within limits (≤2MB and ≤1024x1024) uploaded as-is without resizing
10. Resize failures handled gracefully (return error, not crash application)
11. Thumbnails stored with content-disposition: inline (for browser viewing)
12. Logs resize operations with performance metrics per NFR-9

## Tasks / Subtasks

- [ ] **CRITICAL INVESTIGATION**: Test Sharp Compatibility with Cloudflare Workers (AC: #2, #3)
  - [ ] Install sharp library (`npm install sharp @types/sharp`)
  - [ ] Create test endpoint in staging environment
  - [ ] Deploy to Cloudflare Workers and test image resizing
  - [ ] Document results: Does sharp work with native bindings in Workers?
  - [ ] If sharp fails: Evaluate fallback options (client-side canvas or Cloudflare Images API)
  - [ ] Make architectural decision: sharp vs fallback implementation

- [ ] Implement Image Resize Utility (AC: #2, #3, #8, #9, #10, #12) - Conditional on Sharp Test
  - [ ] Create `/src/lib/images/resize.ts` module
  - [ ] Define constants: MAX_THUMBNAIL_SIZE (2MB), MAX_DIMENSIONS (1024x1024)
  - [ ] Implement `resizeImage(arrayBuffer, filename)` function
  - [ ] Check if resize needed (dimensions or file size)
  - [ ] If within limits, return original buffer unchanged
  - [ ] If oversized, resize using sharp (fit: inside, withoutEnlargement: true)
  - [ ] Convert resized images to JPEG (85% quality) for consistency
  - [ ] Preserve aspect ratio during resize
  - [ ] Handle resize failures gracefully (return null, log error)
  - [ ] Add structured logging (start, complete, failed, skipped)
  - [ ] Log performance metrics: original size, resized size, reduction %, duration

- [ ] Implement Thumbnail Upload API Endpoint (AC: #1, #4, #7, #11)
  - [ ] Create `/src/routes/api/images/upload.ts` endpoint
  - [ ] Accept POST requests with image files
  - [ ] Validate file type (image/png, image/jpeg, image/jpg)
  - [ ] Read file as ArrayBuffer
  - [ ] Call resizeImage() utility
  - [ ] If resize fails, return 422 RESIZE_FAILED error per AC#4
  - [ ] Upload resized image to R2 with `thumbnails/` prefix
  - [ ] Use UUID-based R2 key + .jpg extension
  - [ ] Set content-disposition: inline (enables browser viewing)
  - [ ] Return R2 URL in 201 response
  - [ ] Add structured logging

- [ ] Integrate Thumbnail Upload with Zip Import Flow (AC: #1)
  - [ ] Modify Story 2.4 bulk import endpoint
  - [ ] For each image file in selected files, call thumbnail upload
  - [ ] Store thumbnail URL in model/slice thumbnailUrl field
  - [ ] Handle thumbnail upload failures gracefully (log warning, continue import)
  - [ ] Show thumbnail preview in file selection grid (Story 2.4 UI)

- [ ] Implement Manual Thumbnail Upload/Replace (AC: #7)
  - [ ] Add thumbnail upload button to model detail page UI
  - [ ] Add thumbnail upload button to slice detail page UI
  - [ ] Accept new image file via file input
  - [ ] Call /api/images/upload endpoint
  - [ ] Update model/slice thumbnailUrl in database
  - [ ] Delete old thumbnail from R2 (cleanup)
  - [ ] Show new thumbnail immediately in UI

- [ ] Implement Default Placeholder Image (AC: #5)
  - [ ] Create or source placeholder image for models (generic 3D icon)
  - [ ] Create or source placeholder image for slices (generic gcode icon)
  - [ ] Store placeholders in public assets directory
  - [ ] Display placeholder when thumbnailUrl is null
  - [ ] Ensure placeholders work in all UI contexts (grid, detail pages)

- [ ] Handle Thumbnail Extraction from .gcode.3mf (AC: #6) - DEFERRED TO EPIC 3
  - [ ] Document that .gcode.3mf thumbnail extraction requires Epic 3
  - [ ] Add TODO comment in code: "Epic 3: Extract thumbnail from .gcode.3mf metadata"
  - [ ] Ensure database schema supports thumbnailUrl for slices (already done in Story 2.1)
  - [ ] Plan integration point: Epic 3 Story 3.1 will populate thumbnailUrl during metadata extraction

- [ ] Implement Fallback if Sharp Fails (Conditional on Sharp Test Result)
  - [ ] OPTION A: Client-side canvas resizing
    - [ ] Implement browser-based image resize using Canvas API
    - [ ] Resize on client before uploading to server
    - [ ] Server accepts pre-resized images (validation only)
  - [ ] OPTION B: Cloudflare Images API
    - [ ] Investigate Cloudflare Images pricing and limits
    - [ ] Integrate Cloudflare Images API for server-side resizing
    - [ ] Update endpoints to use Cloudflare Images instead of sharp
  - [ ] OPTION C: Accept oversized images, warn user per AC#4
    - [ ] Show warning: "This image is too large and cannot be resized"
    - [ ] Mark file as unselectable in import UI
    - [ ] Suggest user resize image offline before uploading

- [ ] Write Unit Tests
  - [ ] Test resizeImage() with images within limits (no resize)
  - [ ] Test resizeImage() with oversized dimensions (resize applied)
  - [ ] Test resizeImage() with oversized file size (resize applied)
  - [ ] Test aspect ratio preservation during resize
  - [ ] Test JPEG conversion after resize
  - [ ] Test resize failure handling (corrupted image)
  - [ ] Test thumbnail upload API endpoint (valid PNG, valid JPEG)
  - [ ] Test invalid image type rejection (e.g., .gif, .bmp)
  - [ ] Test R2 upload with correct headers (content-disposition: inline)
  - [ ] Test logging events (start, complete, failed, skipped)

## Dev Notes

### **CRITICAL: Sharp Compatibility with Cloudflare Workers**

**INVESTIGATION REQUIRED BEFORE IMPLEMENTATION:**

The tech spec identifies a critical compatibility concern (lines 1246-1248):

> **Note:** sharp requires native bindings which may not work in Cloudflare Workers. Testing required in Story 2.6 implementation.

**Sharp Library Background:**

Sharp is a popular Node.js image processing library that uses libvips (native C library) for high-performance image operations. However:
- Cloudflare Workers use V8 isolates (not full Node.js runtime)
- Native bindings (C/C++ modules) are **not supported** in Workers
- Sharp relies on native bindings for libvips

**Testing Strategy:**

1. **Step 1: Install sharp** and deploy a test endpoint to staging
2. **Step 2: Attempt image resize** in Cloudflare Workers environment
3. **Step 3: Document results:**
   - ✅ If sharp works: Proceed with sharp implementation
   - ❌ If sharp fails: Choose fallback option

**Fallback Options (if Sharp Fails):**

**Option A: Client-Side Canvas Resizing** (Recommended)
- Resize images in browser using Canvas API before upload
- Server accepts pre-resized images (validation only)
- **Pros**: No server-side dependencies, works everywhere
- **Cons**: Requires client-side JavaScript, slower for large batches

**Option B: Cloudflare Images API**
- Use Cloudflare's managed image transformation service
- Pricing: $5/month for 100k transformations + storage costs
- **Pros**: Server-side, no compatibility issues
- **Cons**: Additional cost, vendor lock-in

**Option C: Accept Oversized Images with Warning**
- Per AC#4 and FR-3, if resizing fails, mark image as unselectable
- Show warning: "This image is too large (XMB). Please resize to ≤2MB and ≤1024x1024"
- **Pros**: Simple implementation, no new dependencies
- **Cons**: Poor UX, requires manual user intervention

**Recommendation:**

Per tech spec line 1248, if sharp fails, implement **Option A (client-side canvas resizing)** because:
- No additional costs
- Works in all environments (browser + Workers)
- Good UX (automatic resizing without user intervention)
- Maintains Story 2.3's client-side processing pattern

### Technical Approach

**Thumbnail Resize Requirements:**

Per NFR-2 and AC#2, thumbnails must meet these limits:
- **File size**: ≤2MB
- **Dimensions**: ≤1024x1024 pixels

**Resize Strategy:**

```
if (image.width > 1024 OR image.height > 1024 OR fileSize > 2MB):
    resize(maxDimensions=1024, fit=inside, preserveAspectRatio=true)
    convert(format=JPEG, quality=85%)
else:
    upload original unchanged
```

**Why Convert to JPEG:**

Per tech spec lines 1297, 1381:
- Consistent format across all thumbnails (simplifies UI rendering)
- Better compression than PNG for photos
- Quality 85% provides good visual quality with smaller file sizes
- All resized thumbnails become .jpg regardless of original format

**Aspect Ratio Preservation:**

Per AC#3, resizing must preserve aspect ratio:
- `fit: inside` - Shrinks image to fit within 1024x1024 box
- `withoutEnlargement: true` - Never upscale small images
- Example: 2000x1000 → 1024x512 (not 1024x1024 with cropping)

**Content-Disposition Headers:**

Per AC#11 and tech spec line 1386:
- Thumbnails: `content-disposition: inline` (browser displays)
- Models/Slices: `content-disposition: attachment` (browser downloads)

This distinction allows thumbnails to be viewed directly in browser (e.g., `<img src="r2-url">`) without forcing download.

**R2 Storage Organization:**

Following Story 2.2/2.5 pattern, use prefixed R2 keys:
- Models: `models/uuid-filename.stl`
- Slices: `slices/uuid-filename.gcode.3mf`
- Thumbnails: `thumbnails/uuid.jpg`

Note: Thumbnails always use `.jpg` extension after resize (per JPEG conversion strategy).

### Integration with Story 2.4 (Bulk Import)

**Thumbnail Handling During Zip Import:**

Per AC#1, image files in zip archives should be uploaded as thumbnails:

```
User uploads zip containing:
  - baby-whale.stl (model file)
  - baby-whale.png (thumbnail image)

Story 2.3 (extraction):
  → Extract both files
  → Display in file selection grid
  → Show actual thumbnail preview for .png

Story 2.4 (import):
  → User selects both files
  → Import model file → models table
  → Import thumbnail image → resize → upload → get R2 URL
  → Link thumbnail to model: UPDATE models SET thumbnailUrl = '...' WHERE id = '...'
```

**Implementation Notes:**

- Thumbnail upload happens **during** bulk import (Story 2.4)
- Each image file triggers thumbnail resize + R2 upload
- Thumbnail URL stored in model/slice `thumbnailUrl` field
- If thumbnail upload fails, log warning but continue import (don't block model import)

### Epic 3 Integration Point (Slice Thumbnail Extraction)

**AC#6: Thumbnails from .gcode.3mf Files**

Bambu Lab .gcode.3mf files contain embedded thumbnails in their metadata. However:
- Extraction requires parsing the .gcode.3mf ZIP structure
- Thumbnail data is embedded in `Metadata/project_settings.config` JSON
- This is **deferred to Epic 3 Story 3.1** (metadata extraction)

**Story 2.6 Scope:**
- Manual thumbnail upload/replace for slices ✅
- Database schema supports `thumbnailUrl` for slices ✅ (Story 2.1)
- Automatic extraction from .gcode.3mf ❌ (Epic 3)

**Epic 3 Story 3.1 will:**
- Parse .gcode.3mf files
- Extract embedded thumbnail image data
- Decode base64 thumbnail (if needed)
- Upload thumbnail to R2
- Populate `slices.thumbnailUrl` field

### Default Placeholder Images

**AC#5: Placeholder When No Thumbnail Available**

When `thumbnailUrl` is null, display default placeholders:

**Model Placeholder:**
- Generic 3D cube/mesh icon
- Suggests "3D model" visually
- Consistent across all model cards without thumbnails

**Slice Placeholder:**
- Generic printer/gcode icon
- Suggests "print file" visually
- Consistent across all slice cards without thumbnails

**Implementation:**
- Store placeholder images in `/public/images/placeholders/`
- Reference in UI: `thumbnailUrl || '/images/placeholders/model.svg'`
- SVG format recommended (scalable, small file size)

**Sources:**
- Create custom placeholders (simple geometric shapes)
- Use open-source icons (Heroicons, Feather Icons, etc.)
- Ensure licensing allows commercial use

### Error Handling Strategy

**Resize Failures (AC#4, AC#10):**

Per FR-3 and AC#4, if resizing fails:
1. Log error with details (filename, error message)
2. Return `null` from `resizeImage()` function
3. API endpoint returns 422 RESIZE_FAILED error
4. Client UI shows warning: "Image resize failed. Image too large or corrupted."
5. Mark image as unselectable in import grid (Story 2.4)
6. Suggest user resize offline or use different image

**Possible Failure Scenarios:**
- Corrupted image file (invalid PNG/JPEG data)
- Extremely large images that exceed memory limits
- Sharp library incompatibility with Cloudflare Workers
- R2 upload failure during thumbnail upload

**Atomic Thumbnail Upload:**

Unlike models/slices, thumbnails don't require database records (just R2 URLs). Therefore:
- No atomic R2+DB requirement
- If R2 upload fails, return error to client
- No cleanup needed (no database state to roll back)

### Project Structure Notes

**New Files to Create:**

- `/src/lib/images/resize.ts` - Image resizing utility (sharp or canvas)
- `/src/routes/api/images/upload.ts` - Thumbnail upload API endpoint
- `/src/__tests__/lib/images/resize.test.ts` - Resize utility tests
- `/src/__tests__/routes/api/images/upload.test.ts` - Upload API tests
- `/public/images/placeholders/model.svg` - Default model placeholder
- `/public/images/placeholders/slice.svg` - Default slice placeholder

**Files to Modify:**

- `/src/routes/api/models/import-zip.ts` - Add thumbnail upload during bulk import (Story 2.4)
- `/src/components/FileSelectionGrid.tsx` - Display actual thumbnail previews (Story 2.4)
- Model detail page UI (Story 2.7) - Add manual thumbnail upload button
- Slice detail page UI (Story 2.8) - Add manual thumbnail upload button

**Dependencies to Add:**

- `npm install sharp @types/sharp` - IF sharp works in Cloudflare Workers
- No new dependencies if using client-side canvas fallback

### Performance Considerations

**Resize Performance:**

Per NFR-1 and tech spec lines 1300-1306, log performance metrics:
- `duration_ms` - Time to resize image
- `original_size` - Original file size in bytes
- `resized_size` - Resized file size in bytes
- `reduction_percent` - Size reduction percentage

**Expected Performance:**
- Sharp (if works): ~50-200ms for typical 5MB images
- Canvas (client-side): ~100-500ms depending on browser/hardware
- Cloudflare Images API: ~500-1000ms (network round-trip)

**Optimization Strategies:**
- Skip resize if image already within limits (AC#9)
- Use JPEG quality 85% (good balance of quality vs size)
- Batch thumbnail uploads asynchronously during bulk import

### Testing Strategy

**Critical Tests:**

1. **Sharp Compatibility Test** (Priority 1)
   - Deploy test endpoint to Cloudflare Workers staging
   - Attempt image resize with sharp library
   - Document success/failure result
   - This determines implementation approach

2. **Resize Logic Tests** (Priority 2)
   - Images within limits (no resize applied)
   - Images over dimension limits (resize applied)
   - Images over size limits (resize applied)
   - Aspect ratio preservation verified
   - JPEG conversion verified

3. **API Endpoint Tests** (Priority 3)
   - Valid PNG upload
   - Valid JPEG upload
   - Invalid type rejection (.gif, .bmp)
   - Resize failure handling (422 response)
   - R2 upload success verification

4. **Integration Tests** (Priority 4)
   - Thumbnail upload during bulk import (Story 2.4 integration)
   - Manual thumbnail upload/replace (Story 2.7/2.8 integration)
   - Placeholder display when thumbnailUrl null

### References

**Source Documents:**

- [Source: docs/epics.md, Story 2.6, lines 320-341] - User story and acceptance criteria
- [Source: docs/tech-spec-epic-2.md, Story 2.6, lines 1227-1421] - Complete implementation specification
- [Source: docs/PRD.md, FR-3] - Oversized image handling requirement
- [Source: docs/PRD.md, NFR-2] - File size and dimension limits
- [Source: docs/PRD.md, NFR-9] - Logging requirements

**Technical Standards:**

- Thumbnail size limits: ≤2MB file size, ≤1024x1024 dimensions [NFR-2]
- Image types: PNG, JPEG/JPG [AC#1]
- Resize quality: JPEG 85% quality [tech-spec line 1297]
- Content disposition: `inline` for thumbnails [AC#11]
- Aspect ratio: Must be preserved [AC#3]
- Error handling: Graceful failures, no crashes [AC#10]
- Logging: Structured events with performance metrics [NFR-9]

**Sharp Library References:**

- Sharp documentation: https://sharp.pixelplumbing.com/
- Sharp API: `sharp(buffer).resize({...}).jpeg({quality: 85}).toBuffer()`
- Cloudflare Workers compatibility: **TESTING REQUIRED**
- Native bindings limitation: Known issue with Workers V8 isolates

**Fallback References:**

- Canvas API (client-side): https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- Cloudflare Images: https://developers.cloudflare.com/images/
- Browser compatibility: Canvas API supported in all modern browsers

**Image Format Standards:**

- JPEG quality scale: 0-100 (85 = good balance for thumbnails)
- Fit modes: `inside` (shrink to fit), `cover` (crop to fill), `contain` (letterbox)
- withoutEnlargement: Prevents upscaling small images

## Dev Agent Record

### Context Reference

- [Story Context XML](/home/taylor/projects/printfarm-manager/docs/story-context-2.2.6.xml) - Generated 2025-10-25

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

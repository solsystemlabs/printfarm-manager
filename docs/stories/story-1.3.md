# Story 1.3: Configure Cloudflare R2 Buckets

Status: Draft

## Story

As a developer,
I want separate R2 buckets for each environment,
so that uploaded files don't mix between dev/staging/production.

## Acceptance Criteria

1. Three R2 buckets created with correct names
2. Versioning enabled on all buckets
3. CORS policy applied to all buckets
4. Wrangler bindings configured per environment
5. Test upload/download successful in dev environment
6. Storage usage visible in Cloudflare Dashboard

## Tasks / Subtasks

- [ ] Create R2 buckets (AC: #1)
  - [ ] Create `pm-dev-files` bucket via Cloudflare Dashboard or wrangler CLI
  - [ ] Create `pm-staging-files` bucket
  - [ ] Create `pm-files` bucket (production)
  - [ ] Verify all buckets visible in Cloudflare Dashboard → R2

- [ ] Enable versioning on all buckets (AC: #2)
  - [ ] Navigate to Cloudflare Dashboard → R2 → pm-dev-files → Settings → Versioning
  - [ ] Enable versioning (disaster recovery per NFR-12)
  - [ ] Repeat for pm-staging-files and pm-files buckets
  - [ ] Verify versioning status shows "Enabled" for all three buckets

- [ ] Configure CORS policy (AC: #3)
  - [ ] Define CORS policy allowing application domains (localhost:3000, pm-staging.solsystemlabs.com, pm.solsystemlabs.com)
  - [ ] Apply CORS policy to pm-dev-files via Dashboard → Settings → CORS Policy
  - [ ] Apply CORS policy to pm-staging-files
  - [ ] Apply CORS policy to pm-files
  - [ ] Verify AllowedMethods: GET, PUT, POST, DELETE

- [ ] Update wrangler.jsonc with R2 bindings (AC: #4)
  - [ ] Add `r2_buckets` array to base config with binding name FILES_BUCKET → pm-dev-files
  - [ ] Add `r2_buckets` to staging env block → pm-staging-files
  - [ ] Add `r2_buckets` to production env block → pm-files
  - [ ] Verify binding syntax: `[[r2_buckets]]` with `binding` and `bucket_name` properties

- [ ] Create R2 test API route (AC: #5)
  - [ ] Create file: `src/routes/api/test-r2.ts`
  - [ ] Implement GET handler that performs upload/download/delete test cycle
  - [ ] Access Cloudflare context: `getContext('cloudflare').env.FILES_BUCKET`
  - [ ] Test upload: `bucket.put('test/test.txt', 'Hello from R2!')`
  - [ ] Test download: `bucket.get('test/test.txt')` and verify content
  - [ ] Test delete: `bucket.delete('test/test.txt')`
  - [ ] Return JSON response with success status and test results

- [ ] Test R2 operations locally (AC: #5)
  - [ ] Start dev server: `npm run dev`
  - [ ] Execute test: `curl http://localhost:3000/api/test-r2`
  - [ ] Verify response: `{"success": true, "content": "Hello from R2!", "message": "R2 read/write/delete successful"}`
  - [ ] Document curl output in Completion Notes

- [ ] Verify storage dashboard access (AC: #6)
  - [ ] Navigate to Cloudflare Dashboard → R2 → Overview
  - [ ] Confirm storage usage metrics are visible
  - [ ] Document dashboard URL path in Dev Notes
  - [ ] Note manual monitoring process (per NFR-2)

## Dev Notes

### Technical Approach

**R2 Bucket Strategy:**

- Cloudflare R2 provides S3-compatible object storage with generous free tier (10GB storage, 1M class A ops/month, 10M class B ops/month)
- Separate buckets per environment ensure complete file isolation (no cross-contamination between dev/staging/production)
- Versioning enabled for disaster recovery (can restore deleted files per NFR-12)
- CORS configuration allows uploads from application domains

**Bucket Naming Convention:**

- Development: `pm-dev-files`
- Staging: `pm-staging-files`
- Production: `pm-files`

**CORS Policy:**

Allows uploads/downloads from application domains with standard HTTP methods.

```json
{
  "AllowedOrigins": [
    "http://localhost:3000",
    "https://pm-staging.solsystemlabs.com",
    "https://pm.solsystemlabs.com"
  ],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

**Wrangler Bindings:**

Bindings connect Workers to R2 buckets. The binding name `FILES_BUCKET` will be used throughout the application to access the environment-specific bucket.

Example binding structure:
```jsonc
{
  "r2_buckets": [
    {
      "binding": "FILES_BUCKET",
      "bucket_name": "pm-dev-files"
    }
  ]
}
```

**Free Tier Limits:**

Per NFR-2, the system must operate within Cloudflare Workers free tier initially:
- R2 Storage: 10GB
- Class A Operations (writes): 1M/month
- Class B Operations (reads): 10M/month

Manual monitoring via Cloudflare Dashboard required in MVP.

### Project Structure Notes

**Files to Create:**

- `src/routes/api/test-r2.ts` - R2 test endpoint for verification

**Files to Modify:**

- `wrangler.jsonc` - Add r2_buckets bindings to all environment blocks

**Alignment with Project Structure:**

- API routes follow TanStack Start file-based routing pattern (`src/routes/api/`)
- Test endpoint temporary for Story 1.3 verification, will be removed or moved to development-only routes in future stories
- R2 client utilities will be created in `src/lib/storage/` in Epic 2 when file upload workflows are implemented

### References

**Source Documents:**

- [Source: docs/tech-spec-epic-1.md, Story 1.3, lines 312-476] - Complete technical specification for R2 bucket setup
- [Source: docs/epics.md, lines 84-103] - User story and acceptance criteria
- [Source: docs/solution-architecture.md, R2 Storage Strategy section] - Bucket-per-environment architecture rationale
- [Source: CLAUDE.md, Working with Cloudflare Workers Context section] - Code examples for accessing R2 bindings via getContext

**Technical Standards:**

- Use `getContext('cloudflare')` to access R2 bucket bindings in API routes
- All file uploads must set explicit `httpMetadata` (content-type, content-disposition) per FR-16
- Atomic operations required: R2 upload first, DB record second, cleanup R2 on DB failure per NFR-4

**R2 API Operations:**

```typescript
// Upload
await bucket.put(key, file, {
  httpMetadata: {
    contentType: 'text/plain',
    contentDisposition: 'attachment; filename="test.txt"'
  }
})

// Download
const object = await bucket.get(key)
const content = await object?.text()

// Delete
await bucket.delete(key)
```

**Testing Commands:**

```bash
# Create buckets via wrangler CLI (alternative to Dashboard)
npx wrangler r2 bucket create pm-dev-files
npx wrangler r2 bucket create pm-staging-files
npx wrangler r2 bucket create pm-files

# List buckets to verify
npx wrangler r2 bucket list

# Test R2 operations
npm run dev
curl http://localhost:3000/api/test-r2
# Expected: {"success": true, "content": "Hello from R2!", "message": "R2 read/write/delete successful"}
```

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML/JSON will be added here by context workflow -->

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

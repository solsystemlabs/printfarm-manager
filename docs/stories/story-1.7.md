# Story 1.7: Implement Storage Usage Visibility Dashboard

Status: Draft

## Story

As an owner,
I want to see total R2 storage consumed and file counts,
so that I can monitor usage against free tier limits and plan for overages.

## Acceptance Criteria

1. `/admin/storage` page accessible (no auth in MVP, but dedicated URL)
2. Dashboard displays total bytes stored across all file types
3. File counts broken down by type: models (.stl, .3mf), slices (.gcode.3mf, .gcode), images (.png, .jpg)
4. Storage displayed in human-readable format (GB/MB)
5. Visual indicator showing percentage of free tier limit (10GB)
6. Refresh button to recalculate storage usage on demand
7. Link to Cloudflare Dashboard for detailed usage analytics
8. Warning shown when >80% of limit
9. Last calculated timestamp displayed

## Tasks / Subtasks

- [ ] Create Storage Calculation Utility (AC: #2, #3, #4)
  - [ ] Create `/src/lib/storage/usage.ts`
  - [ ] Implement `calculateStorageUsage()` function to query Prisma for all file records
  - [ ] Implement `formatBytes()` helper for human-readable format
  - [ ] Calculate breakdown by models, slices, images
  - [ ] Calculate percentage of 10GB free tier limit

- [ ] Create Storage API Endpoint (AC: #2, #6)
  - [ ] Create `/src/routes/api/admin/storage.ts`
  - [ ] Use storage utility to calculate usage
  - [ ] Log calculation performance metrics
  - [ ] Return JSON with total bytes, file counts, breakdown, percentage

- [ ] Create Storage Dashboard Page (AC: #1, #3, #4, #5, #6, #7, #8, #9)
  - [ ] Create `/src/routes/admin/storage.tsx`
  - [ ] Implement React Query to fetch storage data with 5-minute stale time
  - [ ] Display total storage in large, prominent card
  - [ ] Render progress bar showing percentage of free tier
  - [ ] Color-code progress bar: green (<80%), red (≥80%)
  - [ ] Show warning message when approaching limit (≥80%)
  - [ ] Render breakdown cards for models, slices, images
  - [ ] Add "Refresh" button to manually recalculate
  - [ ] Add link to Cloudflare Dashboard R2 page
  - [ ] Display last calculated timestamp

- [ ] Test Storage Dashboard (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [ ] Test with empty database (0 files, 0 bytes)
  - [ ] Test refresh button triggers recalculation
  - [ ] Test warning displays correctly at ≥80% threshold
  - [ ] Test Cloudflare Dashboard link opens correctly
  - [ ] Verify human-readable format (GB/MB/KB)

## Dev Notes

### Technical Approach

**Storage Calculation Strategy:**

This story requires database schema from Epic 2 (models, slices tables with `fileSize` fields). Per tech spec note (line 1478), testing is deferred until after Story 2.1 completes.

The storage calculation queries all file records from the database and sums their `fileSize` fields, rather than querying R2 directly. R2 free tier doesn't provide automatic storage metrics API.

**Caching Strategy:**

Storage calculations are expensive operations requiring full table scans. The dashboard uses:
- React Query with 5-minute `staleTime` (prevents excessive recalculation)
- Manual refresh button for on-demand updates
- Potential future optimization: Background calculation via Cloudflare Workers Cron (per tech spec risk mitigation, lines 1855-1858)

**Implementation Dependencies:**

Per tech spec lines 1233-1281, the `calculateStorageUsage()` function requires:
- `@prisma/client` with models/slices tables (Epic 2, Story 2.1)
- `fileSize` field on both models and slices entities
- `contentType` field to categorize file types

**Free Tier Limits:**

- 10GB storage
- 1M Class A operations/month
- 10M Class B operations/month

Per tech spec line 1227, warning threshold is 80% of limit.

### Project Structure Notes

**Files to Create:**

- `/src/lib/storage/usage.ts` - Storage calculation utility with TypeScript interfaces
- `/src/routes/api/admin/storage.ts` - API endpoint for storage data
- `/src/routes/admin/storage.tsx` - Dashboard page with React Query integration

**Alignment with Project Structure:**

This story implements observability infrastructure (NFR-9) and storage monitoring. The `/admin/storage` route is explicitly documented as "no auth in MVP" but requires knowledge of the dedicated URL.

Component architecture follows TanStack Start patterns:
- API routes use `createFileRoute` and server-side handlers
- Client pages use React Query for data fetching
- Utility functions separated into `lib/` directory

**Deferred Implementation Note:**

Per tech spec lines 1478-1501, this story's implementation is partially deferred:
> "Note: This story requires database schema from Epic 2. Testing deferred until after Story 2.1 (schema implemented)"

The story can be CREATED now with placeholder implementation, but full testing requires:
1. Story 2.1 complete (database schema with models/slices tables)
2. Story 2.2+ complete (actual file uploads to test against)

### References

**Source Documents:**

- [Source: docs/epics.md, Story 1.7, lines 178-199] - User story and acceptance criteria
- [Source: docs/tech-spec-epic-1.md, Story 1.7, lines 1169-1502] - Complete technical specification with code examples
- [Source: docs/tech-spec-epic-1.md, Epic-Level Criteria, lines 1643-1644] - Storage dashboard in epic success criteria

**Technical Standards:**

- Storage calculated by querying database (tech spec line 1230)
- R2 free tier limit: 10GB (tech spec line 1227)
- Warning threshold: 80% (tech spec line 1353, line 1227)
- Caching with 5-minute stale time (tech spec line 1335)
- Human-readable formatting via `formatBytes()` utility (tech spec lines 1273-1281)

**Implementation Examples:**

Per tech spec lines 1212-1462, complete code examples provided for:
- Storage calculation utility (`/src/lib/storage/usage.ts`, lines 1212-1281)
- Storage API endpoint (`/src/routes/api/admin/storage.ts`, lines 1286-1316)
- Storage dashboard page (`/src/routes/admin/storage.tsx`, lines 1321-1462)
- Testing procedures (lines 1476-1501)

**Risk Mitigation:**

Per tech spec lines 1842-1858, if storage calculation becomes too slow at scale:
- Implement background calculation via Cloudflare Workers Cron
- Cache results in database table
- Continue using 5-minute stale time on client

## Dev Agent Record

### Context Reference

- Story Context: `/home/taylor/projects/printfarm-manager/docs/story-context-1.7.xml`

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

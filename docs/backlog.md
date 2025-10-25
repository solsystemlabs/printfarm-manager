# Engineering Backlog

This backlog collects cross-cutting or future action items that emerge from reviews and planning.

Routing guidance:

- Use this file for non-urgent optimizations, refactors, or follow-ups that span multiple stories/epics.
- Must-fix items to ship a story belong in that story’s `Tasks / Subtasks`.
- Same-epic improvements may also be captured under the epic Tech Spec `Post-Review Follow-ups` section.

| Date | Story | Epic | Type | Severity | Owner | Status | Notes |
| ---- | ----- | ---- | ---- | -------- | ----- | ------ | ----- |
| 2025-10-16 | N/A | N/A | Bug | Medium | Developer | Open | Fix hydration warning in route test - `src/__tests__/routes/index.test.tsx:18` HTML structure issue (pre-existing, found during Story 1.1 review) |
| 2025-10-16 | 1.2 | 1 | Security | High | Developer | Resolved | Add `.dev.vars`, `.xata/`, `.xatarc` to `.gitignore` - FIXED: Added to .gitignore lines 10-12 |
| 2025-10-16 | 1.2 | 1 | Bug | High | Developer | Resolved | Implement Prisma Client singleton pattern - FIXED: Created `src/lib/db.ts` with singleton implementation |
| 2025-10-16 | 1.2 | 1 | Bug | High | Developer | Resolved | Fix connection pool leak in error paths - FIXED: Singleton pattern manages pool lifecycle |
| 2025-10-16 | 1.2 | 1 | DevOps | Medium | Developer | Resolved | Add `restart: unless-stopped` to Docker Compose - FIXED: Added to docker-compose.yml:7 |
| 2025-10-16 | 1.2 | 1 | TechDebt | Medium | Developer | Resolved | Replace `process.env` with `getContext('cloudflare').env` - ACCEPTED: process.env works in both local and Workers runtimes per TanStack Start design |
| 2025-10-17 | 2.1 | 2 | Implementation | Medium | Developer | Open | Implement Prisma + Cloudflare Workers bundling configuration - Deferred from Story 1.2. Need to configure Vite/Rollup to properly bundle Prisma Client for Workers runtime. Solution is well-documented and doesn't require additional tools like Accelerate or Hyperdrive. |
| 2025-10-19 | 1.7 | 1 | Documentation | High | TBD | Open | Document R2 API environment variables in `.env.example` or `CLAUDE.md`: CLOUDFLARE_ACCOUNT_ID (optional), CLOUDFLARE_API_TOKEN (optional, needs Account Analytics Read permission), R2_BUCKET_NAME (optional, default: "printfarm-files"), R2_STORAGE_LIMIT_BYTES (optional, default: 10GB) |
| 2025-10-19 | 1.7 | 1 | TechDebt | Medium | TBD | Open | Add integration tests for R2 GraphQL API - Create `src/lib/storage/__tests__/usage.integration.test.ts` validating query structure against Cloudflare's schema using staging credentials (prevents breaking changes going undetected) |
| 2025-10-19 | 1.7 | 1 | Enhancement | Low | TBD | Open | Make storage limit configurable - Replace hard-coded FREE_TIER_LIMIT_BYTES constant with R2_STORAGE_LIMIT_BYTES environment variable at `src/lib/storage/usage.ts:53` (supports paid plans without code changes) |
| 2025-10-19 | 1.7 | 1 | Bug | Low | TBD | Open | Enhance connection cleanup error handling - Add try-catch to Prisma/pool cleanup at `src/routes/api/admin/storage.ts:71-74` to prevent masking primary operation errors |
| 2025-10-19 | 1.7 | 1 | TechDebt | Low | TBD | Open | Add JSDoc comments for remaining functions - Document `fetchStorageUsage()` and `StorageCard` component in `src/routes/admin/storage.tsx:19-28, 243-269` |
| 2025-10-23 | 2.1 | 2 | Bug | High | Developer | Resolved | **[BLOCKER]** Fix Prisma Client Adapter Initialization - FIXED: Implemented dual generator solution (cloudflare + local), added @prisma/adapter-pg with Pool initialization, configured Vitest aliasing for transparent test execution |
| 2025-10-23 | 2.1 | 2 | Bug | High | Developer | Resolved | **[BLOCKER]** Verify Tests Pass After Adapter Fix - FIXED: All 81 tests passing (9 test files, including 23 database tests). CI configured with PostgreSQL service and automatic migrations |
| 2025-10-23 | 2.1 | 2 | Documentation | High | Developer | Resolved | Update Story 2.1 Completion Notes - FIXED: Updated with dual generator solution details, accurate test results, and environment-aware architecture documentation |
| 2025-10-23 | 2.1 | 2 | Documentation | Medium | TBD | Open | Document Cloudflare Workers Adapter Configuration - Create `docs/CLOUDFLARE_PRISMA_SETUP.md` explaining why `engineType = "client"` requires adapter, how it works, environment-specific considerations, and testing strategy for Workers-specific code. (Med-1) |
| 2025-10-23 | 2.1 | 2 | Enhancement | Medium | Developer | Resolved | Implement Environment-Aware Adapter Selection - FIXED: Dual generator solution automatically handles environment-specific requirements (local binary for dev/tests, cloudflare WASM for Workers). Vitest aliasing provides transparent switching. (Med-3) |
| 2025-10-23 | 2.1 | 2 | Documentation | Medium | TBD | Open | Add Inline Schema Comments for SetNull Behavior - Document FR-10 rationale in schema comments at `prisma/schema.prisma:110` (SliceFilament.filament relation) explaining why SetNull was chosen over Restrict. (Low-2) |
| 2025-10-23 | 2.1 | 2 | TechDebt | Low | TBD | Open | Consider Using Default Prisma Output Location - Evaluate if custom `output = "./generated"` is necessary vs default `node_modules/.prisma/client`. Custom path increases cognitive load and requires custom imports. May be intentional for Workers bundling. (Low-1) |
| 2025-10-23 | 2.1 | 2 | TechDebt | Low | TBD | Open | Simplify Test Cleanup Logic - Refactor test cleanup in `src/lib/db/__tests__/schema.test.ts:330-344` to use database transactions for isolation or Prisma's cascade helpers instead of manual ordering with .catch() suppressions. (Low-3) |
| 2025-10-24 | 2.3 | 2 | Enhancement | Medium | TBD | Resolved | Enable JSZip CRC32 Validation - FIXED: `checkCRC32: true` already enabled at `src/lib/zip/client-extractor.ts:106` in client-side implementation. CRC32 validation active for corruption detection. |
| 2025-10-24 | 2.3 | 2 | Enhancement | Low | TBD | Resolved | Add Unit Tests for File Converter - OBSOLETE: File converter removed during client-side pivot. Client-side extraction uses native File objects directly, no conversion needed. |
| 2025-10-24 | 2.3 | 2 | TechDebt | Low | TBD | Resolved | Extract Validation Logic from API Endpoint - OBSOLETE: Server endpoint removed during client-side pivot. Validation now in test UI (`src/routes/test/upload-zip.tsx`). Production validation will be in Story 2.4. |
| 2025-10-24 | 2.3 | 2 | Monitoring | Low | TBD | Resolved | Add Production Memory Usage Logging - Updated for client-side. Server-side memory concern resolved by pivot. New item added for browser memory monitoring (2025-10-25 entry below). |
| 2025-10-24 | 2.3 | 2 | Testing | Low | TBD | Open | Add Path Traversal Security Test - Add test case with malicious paths (e.g., "../../etc/passwd.stl") to `src/__tests__/lib/zip/client-extractor.test.ts` (updated path for client-side). Verify JSZip normalizes path and extractor returns safe path. Related AC: #4 |
| 2025-10-25 | 2.3 | 2 | Enhancement | Low | TBD | Open | Add Memory Usage Logging (Client-Side) - Add optional performance.memory logging in `src/lib/zip/client-extractor.ts` if available in browser. Helps identify memory patterns with large (500MB) files. Browser memory management is automatic, so this is monitoring only. |
| 2025-10-25 | 2.3 | 2 | Enhancement | Low | TBD | Open | Enforce File Size Limit in Test UI - Prevent extraction if file size > 500MB in `src/routes/test/upload-zip.tsx:74-76` (currently just warns). Test UI should demonstrate proper validation patterns for Story 2.4. |
| 2025-10-25 | 2.3 | 2 | Testing | Low | TBD | Open | Add Large File Stress Test - Add test with 50+ files in `src/__tests__/lib/zip/client-extractor.test.ts` to verify progress callback smoothness with larger archives. Mark as optional/skipped (may be slow in CI). |
| 2025-10-25 | 2.3 | 2 | Documentation | Low | TBD | Open | Document Console Logging Deviation - Add comment at `src/lib/zip/client-extractor.ts:179, 190` explaining use of console.log instead of structured logger (intentional for browser environment). |

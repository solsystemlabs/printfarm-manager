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

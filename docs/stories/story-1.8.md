# Story 1.8: Migrate from Cloudflare Workers to Netlify Functions

Status: Pending

## Story

As a developer,
I want to migrate the deployment platform from Cloudflare Workers to Netlify Functions,
so that we can support larger file processing and use standard Node.js runtime patterns.

## Context

Stories 2.2, 2.3, and 2.4 revealed fundamental incompatibilities between Cloudflare Workers runtime and TanStack Start's full-stack requirements:

- **Story 2.2**: Required complex WASM Prisma generator and per-request connection management
- **Story 2.3**: Hit hard limit—128MB memory insufficient for 500MB zip extraction, forcing emergency pivot to client-side processing
- **Story 2.4**: Built on compromised foundation with workarounds

This migration story supersedes the Cloudflare-specific infrastructure stories (1.1-1.5) while preserving R2 for object storage.

## Prerequisites

Epic 1 Stories 1.1-1.5 (understanding of original Cloudflare setup)

## Acceptance Criteria

### Platform Migration

1. Netlify site created and connected to GitHub repository
2. Build configuration defined in `netlify.toml` with environment contexts:
   - Development (local)
   - Staging (master branch → pm-staging.solsystemlabs.com)
   - Production (production branch → pm.solsystemlabs.com)
3. Custom domains configured and SSL certificates active
4. Deploy previews enabled for all pull requests
5. Branch deploys configured for master (staging) and production branches

### Database Migration

6. Neon PostgreSQL project created with three branches: development, staging, production
7. Database connection strings configured in Netlify environment variables per deployment context
8. Prisma schema updated to use standard generator (remove Cloudflare WASM generator)
9. Database migrations tested in all three environments
10. Prisma client working with standard Node.js patterns (no per-request factory needed)

### R2 Storage Access Update

11. R2 API tokens created with read/write permissions for each bucket
12. Environment variables configured in Netlify Dashboard:
    - `R2_ACCOUNT_ID`
    - `R2_ACCESS_KEY_ID`
    - `R2_SECRET_ACCESS_KEY`
    - `R2_BUCKET_NAME` (environment-specific: pm-dev-files, pm-staging-files, pm-files)
13. AWS SDK S3 client configured for R2 access (replace native bindings)
14. Test upload/download confirmed working in all environments
15. Storage client abstraction updated to use S3 SDK patterns

### Code Updates

16. All `getContext('cloudflare')` patterns replaced with `process.env` access
17. Environment variable access standardized across codebase
18. Netlify Functions limits documented (10s timeout, 1GB memory)
19. Local development environment updated (`.env.local` for credentials)

### Documentation Updates

20. CLAUDE.md deployment section replaced (lines 91-268) with Netlify documentation
21. PRD infrastructure references updated (9 edits documented in change proposal)
22. epics.md updated with deprecation notice on Stories 1.1-1.5
23. solution-architecture.md updated with new platform architecture
24. New NETLIFY_SETUP.md created with step-by-step setup guide
25. CLOUDFLARE_PRISMA_SETUP.md moved to archive

### Code Simplifications (Epic 2)

26. Story 2.2 code simplified: remove WASM generator, per-request connection factory
27. Story 2.3 reverted to server-side extraction (remove client-side extraction utility)
28. Story 2.4 simplified: server handles zip extraction (remove blob-sending workaround)
29. All tests updated and passing

### Verification

30. Successful deployment to all three environments
31. End-to-end test: upload file → store in R2 → save to database → retrieve successfully
32. Logs visible in Netlify Dashboard with function-level observability
33. Deploy preview URL tested with PR branch
34. Performance acceptable: deployments ≤5 minutes, function execution <10s

## Tasks / Subtasks

- [ ] **Set Up Netlify Site** (AC: #1, #2, #3, #4, #5)
  - [ ] Create Netlify account / log in
  - [ ] Connect GitHub repository
  - [ ] Configure build settings: `npm run build`, publish directory `.netlify`
  - [ ] Create `netlify.toml` with environment contexts
  - [ ] Configure custom domains (staging + production)
  - [ ] Enable deploy previews and branch deploys
  - [ ] Test first deployment

- [ ] **Migrate to Neon PostgreSQL** (AC: #6, #7, #8, #9, #10)
  - [ ] Create Neon project
  - [ ] Create three database branches (development, staging, production)
  - [ ] Copy connection strings from Neon dashboard
  - [ ] Add connection strings to Netlify environment variables
  - [ ] Update Prisma schema: remove `@cloudflare` generator, use standard `prisma-client-js`
  - [ ] Run migrations in all environments
  - [ ] Test Prisma client connections
  - [ ] Remove per-request client factory pattern from codebase

- [ ] **Update R2 Access to S3 SDK** (AC: #11, #12, #13, #14, #15)
  - [ ] Generate R2 API tokens in Cloudflare dashboard
  - [ ] Add R2 credentials to Netlify environment variables
  - [ ] Install AWS SDK: `npm install @aws-sdk/client-s3`
  - [ ] Update storage client to use S3Client instead of native bindings
  - [ ] Implement uploadFile() and getPublicUrl() with S3 commands
  - [ ] Test R2 access in all environments

- [ ] **Update Code Patterns** (AC: #16, #17, #18, #19)
  - [ ] Find all `getContext('cloudflare')` usage: `grep -r "getContext('cloudflare')" src/`
  - [ ] Replace with `process.env` patterns
  - [ ] Update environment variable access across API routes
  - [ ] Create `.env.local.example` template for local development
  - [ ] Document Netlify Functions limits in code comments

- [ ] **Update Documentation** (AC: #20, #21, #22, #23, #24, #25)
  - [ ] Replace CLAUDE.md lines 91-268 with Netlify documentation (use change proposal)
  - [ ] Apply PRD updates (9 edits from change proposal)
  - [ ] Update epics.md: add deprecation notice to Stories 1.1-1.5
  - [ ] Update solution-architecture.md (use remaining-artifacts-roadmap.md as guide)
  - [ ] Create NETLIFY_SETUP.md with setup instructions
  - [ ] Rewrite DEPLOYMENT.md for Netlify (replace Cloudflare Workers Builds with Netlify Git deployments, update all CLI commands, secrets management, rollback procedures, monitoring sections)
  - [ ] Move CLOUDFLARE_PRISMA_SETUP.md to `/docs/archive/`

- [ ] **Simplify Epic 2 Code** (AC: #26, #27, #28, #29)
  - [ ] Story 2.2: Remove WASM generator complexity, simplify storage client
  - [ ] Story 2.3: Delete `/src/lib/zip/client-extractor.ts`, restore server-side extraction
  - [ ] Story 2.3: Update upload-zip UI to send zip file to server (not extracted blobs)
  - [ ] Story 2.4: Simplify import API to extract zip on server
  - [ ] Update all tests to reflect simplified architecture
  - [ ] Run full test suite, fix any failures

- [ ] **Verify Migration** (AC: #30, #31, #32, #33, #34)
  - [ ] Deploy to staging, verify successful
  - [ ] Deploy to production, verify successful
  - [ ] Test file upload end-to-end in staging
  - [ ] Check Netlify Dashboard logs
  - [ ] Create test PR, verify deploy preview works
  - [ ] Measure deployment time and function execution time

## Dev Notes

### Migration Strategy

This story represents a **platform migration**, not a feature addition. The goal is to move from Cloudflare Workers to Netlify Functions while maintaining all existing functionality.

**Why Migrate?**

Cloudflare Workers has proven incompatible with TanStack Start's full-stack requirements:
- 128MB memory limit insufficient for 500MB file processing (NFR-2)
- V8 isolate runtime requires WASM compilation for Prisma
- Native bindings create vendor lock-in
- Forced architectural compromises (client-side extraction in Story 2.3)

**Why Netlify?**

Netlify Functions provides a better fit:
- 1GB memory (8x more than Workers)
- Standard Node.js 20 runtime (no WASM needed)
- S3-compatible R2 access (portable pattern)
- TanStack Start officially supports Netlify adapter
- Free tier adequate for MVP (125k invocations/month)

### Platform Comparison

| Feature | Cloudflare Workers | Netlify Functions |
|---------|-------------------|-------------------|
| Memory | 128 MB | 1024 MB (1 GB) |
| Timeout | 30s | 10s |
| Runtime | V8 isolate | Node.js 20 |
| Cost (MVP) | $0 | $0 |
| Prisma | WASM generator | Standard generator |

### Code Pattern Changes

**Before (Cloudflare)**:
```typescript
import { getContext } from 'vinxi/http'

const cf = getContext('cloudflare')
const bucket = cf.env.FILES_BUCKET
await bucket.put(key, content)
```

**After (Netlify)**:
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

await r2Client.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET_NAME,
  Key: key,
  Body: content,
}))
```

### Epic 1 Historical Context

Stories 1.1-1.5 remain in the repository as historical record:
- They document the original Cloudflare Workers approach
- They capture the architectural decisions made at project start
- They show the evolution of the project's infrastructure

**Deprecation Notice** should be added to each:
```markdown
> **DEPRECATED**: This story was superseded by Story 1.10 (Netlify Migration) due to
> Cloudflare Workers memory limitations discovered in Epic 2. See Story 1.10 for
> current deployment infrastructure.
```

### Epic 2 Simplifications

**Story 2.2** becomes simpler:
- Remove `prisma/schema.prisma` dual generator setup
- Remove `src/lib/db/client.ts` per-request factory
- Use standard Prisma Client singleton

**Story 2.3** returns to original design:
- Server-side zip extraction (now feasible with 1GB memory)
- Delete client-side extraction utility
- Simpler user experience (just upload zip, no browser extraction step)

**Story 2.4** workflow simplified:
- Client uploads zip file to server
- Server extracts and presents file selection UI
- User selects files to import
- Server uploads selected files to R2

### Timeline Estimate

**Effort**: 1-2 weeks

**Breakdown**:
- Netlify site setup: 2-4 hours
- Neon database migration: 2-4 hours
- R2 S3 SDK implementation: 4-6 hours
- Code pattern updates: 1-2 days
- Documentation updates: 1-2 days
- Epic 2 simplifications: 2-3 days
- Testing and verification: 1 day

### References

**Source Documents**:
- [Sprint Change Proposal](/docs/SPRINT-CHANGE-PROPOSAL-cloudflare-to-netlify.md)
- [Change Analysis](/docs/sprint-change-analysis-cloudflare-to-netlify.md)
- [PRD Changes](/docs/change-proposals/PRD-netlify-migration.md)
- [CLAUDE.md Changes](/docs/change-proposals/CLAUDE-md-netlify-migration.md)
- [Epics Changes](/docs/change-proposals/epics-netlify-migration.md)
- [Remaining Artifacts Roadmap](/docs/change-proposals/remaining-artifacts-roadmap.md)

**Technical References**:
- TanStack Start Netlify Adapter: https://tanstack.com/start/latest/docs/framework/react/hosting
- Netlify Functions: https://docs.netlify.com/functions/overview/
- Neon PostgreSQL: https://neon.tech/docs
- Cloudflare R2 S3 API: https://developers.cloudflare.com/r2/api/s3/

## Dev Agent Record

### Context Reference

Story created as part of Course Correction workflow on 2025-10-30.

### Agent Model Used

claude-sonnet-4-5-20250929

---

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] All tasks completed
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Deploy previews working
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] Epic 2 code simplified
- [ ] Status updated to "Ready for Review"

# Remaining Artifacts Change Roadmap

**Purpose**: High-level guidance for updating remaining documentation artifacts
**Scope**: Architecture, Tech Specs, Story files, and supporting documentation

---

## Architecture Document (solution-architecture.md)

**Finding**: 71 Cloudflare/Workers/Xata references
**Impact Level**: 🔴 HIGH - Requires comprehensive rewrite

### Sections Requiring Updates

#### 1. Technology Stack Section
**Changes Needed**:
- Replace "Cloudflare Workers" with "Netlify Functions"
- Replace "Xata PostgreSQL" with "Neon PostgreSQL"
- Update runtime description: "Node.js 20 on Netlify Functions" (vs Workers V8 runtime)
- Keep: R2 for object storage (accessed via S3 SDK)
- Keep: Prisma ORM (now uses standard generator, not WASM)

**Key Decisions to Document**:
- Why Netlify over Cloudflare: Memory limits (1GB vs 128MB), standard Node.js runtime
- R2 access pattern: S3-compatible API via AWS SDK
- Neon advantages: Instant branching, PostgreSQL compatibility, simpler than Xata

#### 2. System Components & Architecture Diagrams
**Changes Needed**:
- Update deployment layer: Netlify Functions replaces Workers
- Update database layer: Neon replaces Xata
- API Gateway pattern unchanged (TanStack Start routing)
- Storage layer: R2 accessed via S3 client (not native bindings)

**Diagram Updates Required**:
```
OLD: Browser → Cloudflare Workers → Xata DB
                                 ↓
                              R2 (native bindings)

NEW: Browser → Netlify Functions → Neon PostgreSQL
                                 ↓
                              R2 (via S3 SDK)
```

#### 3. Data Access Patterns
**Changes Needed**:
- Remove `getContext('cloudflare')` patterns
- Replace with standard `process.env` access
- Update R2 access examples to use S3Client
- Update Prisma client initialization (no per-request factory needed)

**Before (Cloudflare)**:
```typescript
const cf = getContext('cloudflare')
const bucket = cf.env.FILES_BUCKET
await bucket.put(key, content)
```

**After (Netlify)**:
```typescript
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
await r2Client.send(new PutObjectCommand({...}))
```

#### 4. Deployment Architecture
**Changes Needed**:
- Replace Workers Builds CI/CD with Netlify Git integration
- Update environment strategy (same 3 environments, different implementation)
- Update secrets management: Wrangler secrets → Netlify environment variables
- Update logging/observability: Cloudflare Dashboard → Netlify Dashboard

#### 5. Performance Considerations (NEW SECTION)
**Add**:
- Netlify Functions limits: 10s timeout, 1GB memory, 125k invocations/month
- Cold start implications (first request after idle period)
- R2 access latency (S3 API vs native bindings - negligible difference)
- Database connection pooling with Neon

#### 6. Security Architecture
**Changes Needed**:
- Update secrets storage: Netlify environment variables
- Update CORS configuration for R2 (same process, different dashboard)
- Add: R2 API token security (never expose credentials client-side)
- Keep: All application-level security unchanged

---

## Tech Spec Documents

**Finding**: 4 of 5 tech spec files contain Cloudflare/Xata references
**Impact Level**: 🟠 MEDIUM - Targeted updates needed

### tech-spec-epic-1.md
**Status**: 🔴 COMPLETE REWRITE REQUIRED
**Reason**: Entire spec is about Cloudflare Workers infrastructure

**Approach**: Rewrite following Epic 1 story changes from epics.md
- Story 1.1 spec: Netlify configuration instead of Wrangler
- Story 1.2 spec: Neon setup instead of Xata
- Story 1.3 spec: R2 + S3 SDK instead of R2 bindings
- Story 1.4 spec: Netlify CI/CD instead of Workers Builds
- Story 1.5 spec: Netlify logging instead of Cloudflare observability

### tech-spec-epic-2.md
**Status**: 🟡 TARGETED UPDATES
**Sections to Update**:
- Story 2.2 (Model Upload): Remove WASM Prisma references, simplify storage client
- Story 2.3 (Zip Extraction): **REVERT to server-side** (undo client-side pivot)
- Story 2.4 (Bulk Import): Simplify (server handles extraction again)

**Key Changes**:
- Remove dual Prisma generator approach (standard generator only)
- Remove per-request connection factory pattern
- Revert Story 2.3 to original server-side extraction design
- Update Story 2.4 to reflect simplified server-side flow

### tech-spec-epic-3.md
**Status**: 🟢 MINIMAL CHANGES
**Changes**:
- Update metadata extraction examples to use standard Node.js patterns
- Remove any Workers-specific runtime considerations
- Benefit: 1GB memory supports larger .gcode.3mf file extraction

### tech-spec-epic-4.md & tech-spec-epic-5.md
**Status**: 🟢 NO CHANGES NEEDED
**Reason**: Platform-agnostic CRUD and UI work

---

## Story Documentation Updates

### Stories 2.2, 2.3, 2.4 (Epic 2)

**Change Type**: Dev Notes updates - remove "architectural pivot" explanations

#### Story 2.2: Model Upload API
**Location**: `/docs/stories/story-2.2.md`
**Changes**:
- **Completion Notes** (lines 209-271): Remove references to "sophisticated architecture decisions" and dual-environment complexity
- **Implementation Summary**: Simplify to reflect standard Node.js patterns
- Update: "Database Client Usage" - no longer needs per-request factory

**New Dev Note to Add**:
```markdown
**Platform Note**: Originally implemented for Cloudflare Workers with WASM Prisma
generator. Simplified after migration to Netlify Functions (standard Node.js runtime).
```

#### Story 2.3: Zip Extraction
**Location**: `/docs/stories/story-2.3.md`
**Changes**: MAJOR - this story's entire narrative needs updating

**Current Status**: "ARCHITECTURAL PIVOT - Client-side extraction" (lines 75-101)

**New Approach**: REVERT TO SERVER-SIDE
- Remove "⚠️ CRITICAL CONSTRAINT" warnings (lines 98-105)
- Update AC#3: "Extracts zip contents in-memory (server-side processing)" - now feasible
- Remove client-side extraction justification
- Update Dev Notes: "Moved back to server-side extraction after Netlify migration (1GB memory)"

**New Dev Note**:
```markdown
**Platform Migration Note (2025-10-30)**: Original implementation was forced to
client-side extraction due to Cloudflare Workers 128MB memory limit. After migration
to Netlify Functions (1GB memory), zip extraction returned to server-side as
originally designed. This simplifies the architecture and improves user experience.
```

#### Story 2.4: Bulk Import UI
**Location**: `/docs/stories/story-2.4.md`
**Changes**:
- Remove "⚠️ CRITICAL CONSTRAINT" warnings (lines 98-105)
- Simplify implementation to reflect server-side extraction
- Update Dev Notes to remove workaround explanations

---

## Supporting Documentation

### CLOUDFLARE_PRISMA_SETUP.md
**Location**: `/docs/CLOUDFLARE_PRISMA_SETUP.md`
**Action**: 🗑️ **DELETE FILE** or rename to `ARCHIVE_CLOUDFLARE_PRISMA_SETUP.md`
**Reason**: No longer relevant - Netlify uses standard Prisma setup

**Alternative**: Create new `NETLIFY_SETUP.md` with:
- Netlify site creation and GitHub connection
- Custom domain configuration
- Environment variable setup (R2, database)
- Neon database connection
- Standard Prisma configuration

### DEPLOYMENT.md
**Location**: `/docs/DEPLOYMENT.md`
**Action**: 🔄 **UPDATE** (read file to assess specific changes needed)
**Likely Changes**:
- Update deployment commands (remove Wrangler references)
- Update environment setup instructions
- Update troubleshooting guide for Netlify-specific issues

### LOGGING.md (if exists)
**Action**: 🔄 **UPDATE** for Netlify Functions logging patterns

---

## Implementation Priority

**Phase 1 - Critical (Before any new dev work)**:
1. ✅ PRD updates
2. ✅ CLAUDE.md rewrite
3. ✅ epics.md Epic 1 rewrite
4. 🔄 tech-spec-epic-1.md rewrite
5. 🔄 solution-architecture.md updates

**Phase 2 - Important (Before continuing Epic 2 work)**:
6. 🔄 tech-spec-epic-2.md updates
7. 🔄 Story 2.2, 2.3, 2.4 dev notes updates
8. 🔄 NETLIFY_SETUP.md creation
9. 🔄 DEPLOYMENT.md updates

**Phase 3 - Cleanup (Can be done in parallel with dev)**:
10. 🔄 tech-spec-epic-3.md minor updates
11. 🔄 Delete/archive CLOUDFLARE_PRISMA_SETUP.md
12. 🔄 Update any remaining deployment references

---

## Validation Checklist

After all changes applied, verify:
- [ ] Zero references to "Cloudflare Workers" in active documentation
- [ ] Zero references to "Xata" in active documentation
- [ ] Zero references to "wrangler" in active documentation
- [ ] All `getContext('cloudflare')` code examples removed
- [ ] All environment variable examples use `process.env`
- [ ] R2 access examples use S3 SDK consistently
- [ ] Netlify configuration documented in netlify.toml
- [ ] Neon database setup documented
- [ ] Epic 1 stories align with Netlify infrastructure
- [ ] Stories 2.2-2.4 dev notes reflect Netlify simplifications

---

## Next Steps

1. Review this roadmap with Taylor
2. Apply changes incrementally (one artifact at a time)
3. Test each change against actual project needs
4. Update roadmap if additional changes discovered
5. Mark items complete as changes are applied

**Status**: Roadmap complete, ready for implementation phase

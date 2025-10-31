# Epics Deprecation Approach: Preserve History, Add Story 1.8

**Document**: `/docs/epics.md`
**Change Type**: Add deprecation notices + new migration story
**Scope**: Preserve Stories 1.1-1.7, add Story 1.8 for Netlify migration

---

## Overview

Rather than rewriting existing Epic 1 stories, we preserve the historical record and add a new story that supersedes them. This approach:

✅ Maintains project history and learnings
✅ Shows the evolution from Cloudflare to Netlify
✅ Keeps original architectural decisions documented
✅ Adds migration story as explicit work item

---

## Change 1: Epic 1 Overview Update

**Location**: Lines 23-34

**Action**: Add note about platform evolution

**Add after line 34**:

```markdown

**Platform Evolution Note (2025-10-30)**: Stories 1.1-1.5 documented the original Cloudflare Workers infrastructure approach. During Epic 2 implementation, Cloudflare Workers memory limitations (128MB vs 500MB file processing requirement) proved incompatible with MVP needs. Story 1.8 documents the migration to Netlify Functions, which supersedes the Cloudflare-specific stories while preserving R2 for object storage.
```

---

## Change 2: Add Deprecation Notices to Stories 1.1-1.5

### Story 1.1 Deprecation Notice

**Location**: After line 55 (end of Story 1.1)

**Add**:

```markdown

> **DEPRECATED (2025-10-30)**: This story was superseded by Story 1.8 (Netlify Migration) due to Cloudflare Workers memory limitations discovered during Epic 2 (Stories 2.2, 2.3, 2.4). See Story 1.8 for current deployment infrastructure. This story remains as historical documentation of the original platform choice.
```

---

### Story 1.2 Deprecation Notice

**Location**: After line 79 (end of Story 1.2)

**Add**:

```markdown

> **DEPRECATED (2025-10-30)**: This story was superseded by Story 1.8, which migrates to Neon PostgreSQL with instant branching capabilities. The Xata-specific branching infrastructure described here is no longer in use. This story remains as historical documentation.
```

---

### Story 1.3 Deprecation Notice

**Location**: After line 101 (end of Story 1.3)

**Add**:

```markdown

> **DEPRECATED (Partially, 2025-10-30)**: R2 buckets remain in use, but access method changed. Story 1.8 documents R2 access via S3-compatible API using AWS SDK (replacing Wrangler native bindings described here). This story remains as historical documentation of the original R2 binding approach.
```

---

### Story 1.4 Deprecation Notice

**Location**: After line 126 (end of Story 1.4)

**Add**:

```markdown

> **DEPRECATED (2025-10-30)**: This story was superseded by Story 1.8, which uses Netlify's Git-based deployments instead of Cloudflare Workers Builds. The CI/CD concepts (branch-based deployments, PR previews) remain the same, but implementation differs. This story remains as historical documentation.
```

---

### Story 1.5 Deprecation Notice

**Location**: After line 150 (end of Story 1.5)

**Add**:

```markdown

> **DEPRECATED (2025-10-30)**: This story was superseded by Story 1.8, which uses Netlify Functions logging instead of Cloudflare Workers Dashboard. The observability goals remain the same, but implementation differs. This story remains as historical documentation.
```

---

## Change 3: Story 1.7 - Minimal Update

**Location**: Line 167

**OLD**:
```
7. Link to Cloudflare Dashboard for detailed usage analytics
```

**NEW**:
```
7. Link to Cloudflare R2 Dashboard for detailed R2 usage analytics
```

**Note**: Story 1.7 remains valid as R2 storage is still in use.

---

## Change 4: Add Story 1.8 to Epic 1

**Location**: After Story 1.7 (after line 174)

**Add**:

```markdown

---

### Story 1.8: Migrate from Cloudflare Workers to Netlify Functions

**As a** developer
**I want** to migrate the deployment platform from Cloudflare Workers to Netlify Functions
**So that** we can support larger file processing and use standard Node.js runtime patterns

**Prerequisites:** Stories 1.1-1.5 (understanding of original Cloudflare setup)

**Context:** Stories 2.2, 2.3, and 2.4 revealed fundamental incompatibilities between Cloudflare Workers runtime and TanStack Start's full-stack requirements. This migration supersedes the Cloudflare-specific infrastructure stories (1.1-1.5) while preserving R2 for object storage.

**Acceptance Criteria:**
1. Netlify site created and connected to GitHub repository
2. Build configuration defined in netlify.toml (development/staging/production contexts)
3. Custom domains configured: pm-staging.solsystemlabs.com, pm.solsystemlabs.com
4. Neon PostgreSQL project created with three branches (development, staging, production)
5. Prisma schema updated to use standard generator (remove Cloudflare WASM generator)
6. R2 API tokens created and configured in Netlify environment variables
7. AWS SDK S3 client implemented for R2 access (replace native bindings)
8. All `getContext('cloudflare')` patterns replaced with `process.env` access
9. CLAUDE.md deployment section replaced with Netlify documentation
10. PRD infrastructure references updated
11. solution-architecture.md updated with new platform architecture
12. Story 2.2 code simplified (remove WASM generator, per-request connection factory)
13. Story 2.3 reverted to server-side extraction (remove client-side workaround)
14. Story 2.4 simplified (server handles zip extraction)
15. Successful deployment to all three environments with end-to-end testing

**Technical Notes:**
- Netlify Functions: 1GB memory (vs Workers 128MB), 10s timeout, Node.js 20 runtime
- Neon PostgreSQL: Instant branching, standard PostgreSQL compatibility
- R2 access via S3-compatible API using @aws-sdk/client-s3
- See full story documentation: `/docs/stories/story-1.8.md`

**Effort Estimate:** 1-2 weeks

**Story Status:** Pending

**Detailed Documentation:** [Story 1.8](/docs/stories/story-1.8.md)
```

---

## Change 5: Update Epic 1 Story Count

**Location**: Lines 15-16

**OLD**:
```
**Epic 1: Deployment & Operations Foundation** (6 stories, Weeks 1-2, CRITICAL)
```

**NEW**:
```
**Epic 1: Deployment & Operations Foundation** (7 stories, Weeks 1-2, CRITICAL)
```

**Rationale**: Adding Story 1.8 increases count from 6 to 7 stories

---

## Summary

**Approach**: Preserve + Deprecate + Add New

**Stories Preserved**: 1.1, 1.2, 1.3, 1.4, 1.5 (with deprecation notices)
**Stories Unchanged**: 1.7 (R2 storage dashboard - still relevant)
**Stories Added**: 1.10 (Netlify migration)

**Benefits**:
- ✅ Historical record intact
- ✅ Shows project evolution and learnings
- ✅ Clear migration path documented
- ✅ No information loss

**Documentation Changes**:
- 5 deprecation notices added (Stories 1.1-1.5)
- 1 story summary added to epics.md (Story 1.8)
- Full story detail in `/docs/stories/story-1.8.md`

**Next Steps**:
1. Apply deprecation notices to epics.md
2. Add Story 1.8 summary to epics.md
3. Story 1.8 detailed documentation already created

# PRD Change Proposal: Cloudflare → Netlify Migration

**Document**: `/docs/PRD.md`
**Change Type**: Platform infrastructure updates
**Scope**: Replace Cloudflare Workers references with Netlify Functions; replace Xata with Neon

---

## Change 1: Description Section - Technology Stack Reference

**Location**: Line 18

**OLD**:
```
Built on TanStack Start and Cloudflare Workers with R2 storage, it requires zero monetary investment beyond development time.
```

**NEW**:
```
Built on TanStack Start and Netlify Functions with Cloudflare R2 storage, it requires zero monetary investment beyond development time.
```

**Rationale**: Update deployment platform while preserving R2 for object storage. Maintains zero-cost infrastructure claim (Netlify free tier).

---

## Change 2: Context Section - Technical Readiness

**Location**: Line 51

**OLD**:
```
**Technical Readiness (Infrastructure):** TanStack Start, Cloudflare Workers, and R2 storage are production-ready now with zero hosting costs. These conditions weren't true 2 years ago. Waiting doesn't improve the technical foundation—it's optimal today.
```

**NEW**:
```
**Technical Readiness (Infrastructure):** TanStack Start, Netlify Functions, and Cloudflare R2 storage are production-ready now with zero hosting costs. These conditions weren't true 2 years ago. Waiting doesn't improve the technical foundation—it's optimal today.
```

**Rationale**: Update infrastructure readiness statement to reflect Netlify as deployment platform. R2 remains for storage (accessed via Netlify environment variables).

---

## Change 3: Context Section - Technical Infrastructure Dependencies

**Location**: Line 61

**OLD**:
```
*What this system depends on:* All upstream dependencies are ready or owner-controlled. Technical infrastructure is production-ready (TanStack Start, Cloudflare Workers/R2, Prisma). Domain knowledge is documented (Bambu Lab metadata format, recipe repository model, AMS slot tracking requirements). Operational inputs are owner-controlled (model uploads, sliced files, product definitions). Zero external blockers—no waiting on vendors, approvals, or unproven technology.
```

**NEW**:
```
*What this system depends on:* All upstream dependencies are ready or owner-controlled. Technical infrastructure is production-ready (TanStack Start, Netlify Functions, Cloudflare R2, Prisma with Neon PostgreSQL). Domain knowledge is documented (Bambu Lab metadata format, recipe repository model, AMS slot tracking requirements). Operational inputs are owner-controlled (model uploads, sliced files, product definitions). Zero external blockers—no waiting on vendors, approvals, or unproven technology.
```

**Rationale**: Update infrastructure stack. Adds Neon as PostgreSQL provider (replacing Xata). Clarifies R2 is for storage, Netlify for compute.

---

## Change 4: NFR-10 - Deployment and Environment Management

**Location**: Lines 335-340

**OLD**:
```
**NFR-10: Deployment and Environment Management**

- System shall use Cloudflare Workers Builds for automated deployments (staging on master branch, production on production branch)
- System shall deploy to separate environments: development (local), staging (pm-staging.solsystemlabs.com), production (pm.solsystemlabs.com)
- System shall use environment-specific configuration with separate R2 buckets per environment and leverage Xata's database branching infrastructure for PR-specific database branches
- System shall complete deployments in ≤5 minutes from git push to live environment
```

**NEW**:
```
**NFR-10: Deployment and Environment Management**

- System shall use Netlify's Git-based deployments for automated deployments (staging on master branch, production on production branch)
- System shall deploy to separate environments: development (local), staging (pm-staging.solsystemlabs.com), production (pm.solsystemlabs.com)
- System shall use environment-specific configuration with separate Cloudflare R2 buckets per environment and Neon database branches for PR-specific database isolation
- System shall complete deployments in ≤5 minutes from git push to live environment
```

**Rationale**:
- Netlify provides Git-based CD similar to Cloudflare Workers Builds
- R2 buckets remain for storage (environment-specific as before)
- Neon database branching replaces Xata branching (similar capability)
- 5-minute deployment target remains achievable

---

## Change 5: Epic 1 Description

**Location**: Lines 742-747

**OLD**:
```
**Epic 1: Deployment & Operations Foundation** (Stories: 6-8, Priority: CRITICAL)
- Establishes three environments (dev/staging/production) with automated deployments
- Configures Cloudflare Workers, Xata database branching, R2 buckets
- Implements logging and observability via Cloudflare Dashboard
- Provides storage usage visibility dashboard

- **Rationale:** Without deployment infrastructure, no features can be tested or released
```

**NEW**:
```
**Epic 1: Deployment & Operations Foundation** (Stories: 6-8, Priority: CRITICAL)
- Establishes three environments (dev/staging/production) with automated deployments
- Configures Netlify Functions, Neon database branches, Cloudflare R2 buckets
- Implements logging and observability via Netlify Dashboard
- Provides storage usage visibility dashboard

- **Rationale:** Without deployment infrastructure, no features can be tested or released
```

**Rationale**: Update Epic 1 summary to reflect new infrastructure stack. Functional goals remain identical.

---

## Change 6: Phase 1 Timeline Description

**Location**: Lines 779-781

**OLD**:
```
**Phase 1 (Weeks 1-2): Infrastructure & Foundation**
- Epic 1 completed first to establish deployment pipeline
- Cloudflare Workers environments, Xata database, R2 buckets configured
```

**NEW**:
```
**Phase 1 (Weeks 1-2): Infrastructure & Foundation**
- Epic 1 completed first to establish deployment pipeline
- Netlify environments, Neon database, Cloudflare R2 buckets configured
```

**Rationale**: Update timeline description to match new infrastructure.

---

## Change 7: Success Criteria - Deployment Testing

**Location**: Line 938

**OLD**:
```
  - Test Cloudflare Workers Builds deployment pipeline
```

**NEW**:
```
  - Test Netlify Git deployment pipeline
```

**Rationale**: Update deployment testing criteria.

---

## Change 8: Sprint 0 Assignment

**Location**: Line 959

**OLD**:
```
**Sprint 0 (Pre-Development):** Epic 1 - Deployment & Operations Foundation
```

**NEW**:
```
**Sprint 0 (Pre-Development):** Epic 1 - Deployment & Operations Foundation (Netlify)
```

**Rationale**: Clarify Epic 1 will use Netlify infrastructure.

---

## Change 9: Target Deployment URLs (Reference Update)

**Location**: Line 1068

**OLD**:
```
**Target Deployment:** Staging (pm-staging.solsystemlabs.com), Production (pm.solsystemlabs.com)
```

**NEW**:
```
**Target Deployment:** Staging (pm-staging.solsystemlabs.com via Netlify), Production (pm.solsystemlabs.com via Netlify)
```

**Rationale**: Clarify deployment method (URLs remain unchanged).

---

## Summary

**Total Changes**: 9 edits across PRD
**Sections Affected**: Description, Context, NFR-10, Epic descriptions, Timeline, Success criteria
**Functional Changes**: None - only infrastructure implementation details
**MVP Scope Impact**: None - all goals and requirements remain valid

**Next Steps**: Apply these changes to PRD.md

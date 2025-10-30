# DEPLOYMENT.md Assessment

**File**: `/docs/DEPLOYMENT.md`
**Size**: 465 lines
**Status**: 🔴 **COMPREHENSIVE REWRITE REQUIRED**

---

## Finding

DEPLOYMENT.md is **entirely Cloudflare Workers-specific**:
- Line 3: "using Cloudflare Workers Builds"
- Lines 19-51: Pull Request Previews (Cloudflare-specific workflow)
- Lines 53-81: Staging deployment via Cloudflare
- Lines 83-111: Production deployment via Cloudflare
- Lines 144-151: `CLOUDFLARE_ENV` build variable explanation
- Lines 154-187: Rollback via Cloudflare Dashboard
- Lines 209-236: Cloudflare Dashboard monitoring
- Lines 238-251: Wrangler CLI commands
- Lines 313-330: Manual deployment with Wrangler
- Lines 332-387: Secrets management via Wrangler
- Lines 389-417: Cloudflare-specific features (Smart Placement, Observability)

**Entire document needs Netlify equivalent.**

---

## Recommendation

**Add to Story 1.8 Tasks** (don't create detailed proposal now)

**Why**:
- Similar to tech specs—better written during actual implementation
- Deployment commands will be verified hands-on during Story 1.8
- Smoke test scripts may need updates (we'll discover this during setup)

**What to Add**:

### New Subtask for Story 1.8

**Location**: After "Update Documentation" task group

```markdown
- [ ] **Rewrite DEPLOYMENT.md for Netlify** (AC: #24 expanded)
  - [ ] Replace Cloudflare Workers Builds section with Netlify Git deployments
  - [ ] Update PR preview workflow (deploy-preview URLs)
  - [ ] Update staging/production deployment workflows
  - [ ] Replace Wrangler CLI commands with Netlify CLI equivalents
  - [ ] Update secrets management (Wrangler → Netlify environment variables)
  - [ ] Update rollback procedures (Cloudflare Dashboard → Netlify Dashboard)
  - [ ] Update monitoring sections (logs, deployments)
  - [ ] Verify smoke test scripts still work (update if needed)
  - [ ] Remove Smart Placement / Observability sections (Cloudflare-specific)
```

---

## Alternative: Create Detailed Proposal Now

If you prefer a detailed proposal before starting Story 1.8, I can create:
- Line-by-line changes for DEPLOYMENT.md
- Complete Netlify equivalent text
- Smoke test script updates

**Effort**: ~1-2 hours to create proposal

**Trade-off**: More planning now vs iterate during implementation

---

## Recommendation

**Option A (Recommended)**: Add DEPLOYMENT.md rewrite as Story 1.8 subtask
- Faster to start Story 1.8
- Write docs based on actual implementation experience
- Less risk of proposal being wrong

**Option B**: Create detailed proposal now
- More upfront planning
- All docs ready before coding starts
- Slightly slower to begin

---

## Your Decision Needed

1. **Add DEPLOYMENT.md as Story 1.8 task** (recommended)
2. **Create detailed proposal now** (I can do in ~1-2 hours)

Which do you prefer?

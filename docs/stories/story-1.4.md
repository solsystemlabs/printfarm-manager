# Story 1.4: Implement Cloudflare Workers Builds CI/CD

Status: ContextReadyDraft

## Story

As a developer,
I want automated deployments via Cloudflare Workers Builds,
so that pushing to master/production branches automatically deploys to staging/production.

## Acceptance Criteria

1. GitHub repository connected to Cloudflare Workers Builds
2. Build configuration set: `npm run build` command
3. Staging deployment configured for `master` branch using `npx wrangler deploy --env staging`
4. Production deployment configured for `production` branch using `npx wrangler deploy --env production`
5. PR preview builds configured to generate isolated preview URLs
6. Preview builds use `npx wrangler versions upload --env staging` (no impact on live staging)
7. Deployment completes in ≤5 minutes from git push (per NFR-10)
8. Failed builds prevent deployment and notify via Cloudflare Dashboard

## Tasks / Subtasks

- [ ] Connect GitHub repository to Cloudflare Workers Builds (AC: #1)
  - [ ] Navigate to Cloudflare Dashboard → Workers & Pages → Create → Connect Git
  - [ ] Select GitHub repository: `solsystemlabs/printfarm-manager`
  - [ ] Configure project settings (name, build command, output directory)
  - [ ] Authorize Cloudflare access to GitHub repository

- [ ] Configure build settings (AC: #2)
  - [ ] Set build command: `npm run build`
  - [ ] Set build output directory: `dist/server`
  - [ ] Verify TanStack Start generates `wrangler.json` during build

- [ ] Configure branch-based deployments (AC: #3, #4)
  - [ ] Set production branch: `production`
  - [ ] Configure `master` branch as preview branch (deploys to staging)
  - [ ] Enable PR preview builds
  - [ ] Verify branch deployment settings in Cloudflare Dashboard

- [ ] Set environment variables for builds (AC: #3, #4)
  - [ ] Production branch: Set `CLOUDFLARE_ENV=production`
  - [ ] Preview branches (master + PRs): Set `CLOUDFLARE_ENV=staging`
  - [ ] Configure `DATABASE_URL` secret per environment
  - [ ] Verify environment variables applied correctly

- [ ] Test PR preview workflow (AC: #5, #6)
  - [ ] Create test branch and PR
  - [ ] Verify Cloudflare builds automatically
  - [ ] Verify isolated preview URL generated (format: `<branch-name>-pm-staging.<subdomain>.workers.dev`)
  - [ ] Access preview URL and verify environment indicator shows "STAGING"
  - [ ] Confirm preview does NOT affect live staging environment
  - [ ] Merge PR and verify preview URL deleted

- [ ] Test staging deployment (AC: #3, #7)
  - [ ] Push minor change to `master` branch
  - [ ] Monitor Cloudflare Dashboard for build status
  - [ ] Verify deployment completes in ≤5 minutes
  - [ ] Access https://pm-staging.solsystemlabs.com
  - [ ] Verify changes deployed and environment indicator shows "STAGING"

- [ ] Test production deployment (AC: #4, #7)
  - [ ] Merge `master` → `production`
  - [ ] Monitor Cloudflare Dashboard for build status
  - [ ] Verify deployment completes in ≤5 minutes
  - [ ] Access https://pm.solsystemlabs.com
  - [ ] Verify changes deployed and environment indicator shows "PRODUCTION"

- [ ] Test failed build handling (AC: #8)
  - [ ] Create branch with intentional TypeScript error
  - [ ] Push to GitHub and create PR
  - [ ] Verify build fails in Cloudflare Dashboard
  - [ ] Verify deployment does NOT occur
  - [ ] Verify error notification visible in Dashboard

- [ ] Create deployment documentation (AC: #1-8)
  - [ ] Create `/docs/DEPLOYMENT.md` with deployment workflows
  - [ ] Document environment promotion (dev → staging → production)
  - [ ] Document rollback procedure
  - [ ] Include smoke test commands

- [ ] Create smoke test script (Testing)
  - [ ] Create `/scripts/smoke-test.sh`
  - [ ] Test health check endpoint
  - [ ] Test environment API endpoint
  - [ ] Test R2 operations (dev/staging only)
  - [ ] Make script executable and document usage

## Dev Notes

### Technical Approach

**Cloudflare Workers Builds Strategy:**

Cloudflare Workers Builds provides native Git integration for automated CI/CD. Unlike traditional CI/CD platforms, it's tightly integrated with Cloudflare's edge network and optimized for Workers deployments.

**Key Architecture Decisions:**

1. **Branch-Based Deployment Strategy:**
   - `production` branch → Deploy to `pm` worker (production environment)
   - `master` branch → Deploy to `pm-staging` worker (staging environment)
   - PR branches → Isolated preview URLs (no impact on staging)

2. **Environment Variable Injection:**
   - `CLOUDFLARE_ENV` set at build time (not deploy time)
   - TanStack Start's Vite build reads `CLOUDFLARE_ENV` to generate correct `dist/server/wrangler.json`
   - This is why `--env` flag doesn't work with Vite-based projects

3. **PR Preview Isolation:**
   - PR previews use `npx wrangler versions upload --env staging` (creates isolated Worker version)
   - Live staging uses `npx wrangler deploy` (updates active deployment)
   - Same configuration (staging), different deployment mechanism

**Build Process Flow:**

```
1. GitHub push → Triggers Cloudflare build
2. Cloudflare runs: npm install && npm run build
3. Vite reads CLOUDFLARE_ENV variable
4. Vite generates dist/server/wrangler.json with appropriate env config
5. Cloudflare runs: npx wrangler deploy (or versions upload for PRs)
6. Worker deployed to edge network
```

**Deployment Timeline:**

Per NFR-10, deployments must complete in ≤5 minutes. Typical breakdown:
- Git clone: 10-20 seconds
- npm install: 1-2 minutes (cached dependencies)
- npm run build: 30-60 seconds
- wrangler deploy: 30-60 seconds
- Edge propagation: 10-30 seconds
- **Total: 3-5 minutes**

### Project Structure Notes

**Files to Create:**
- `/docs/DEPLOYMENT.md` - Deployment workflow documentation
- `/scripts/smoke-test.sh` - Post-deployment verification script

**Files Referenced:**
- `wrangler.jsonc` - Environment configuration (from Story 1.1)
- `vite.config.ts` - Build configuration (validates TanStack Start integration)
- `.env.example` - Environment variable template (update if needed)

**Cloudflare Dashboard Configuration:**
- Workers & Pages → printfarm-manager → Settings → Builds & Deployments
- Workers & Pages → printfarm-manager → Settings → Environment Variables
- R2 → Buckets (verify bindings work in deployed environments)

**Alignment with Project Structure:**

This story completes the CI/CD foundation established in Stories 1.1-1.3. It enables:
- Automated deployments (reduces manual errors)
- PR preview testing (safe experimentation)
- Environment isolation (prevents production accidents)
- Rapid iteration (5-minute deployment cycle)

### References

**Source Documents:**
- [Source: docs/tech-spec-epic-1.md, Story 1.4, lines 479-670] - Complete technical specification for CI/CD implementation
- [Source: docs/epics.md, lines 106-128] - User story and acceptance criteria
- [Source: CLAUDE.md, Cloudflare Workers Deployment section] - Environment configuration and deployment strategy
- [Source: CLOUDFLARE_SETUP.md] - Detailed Cloudflare Workers Builds setup instructions (if exists)

**Technical Standards:**
- Deployments must complete in ≤5 minutes (NFR-10)
- Failed builds must prevent deployment (safety requirement)
- Preview URLs must be isolated from live environments (safety requirement)
- `CLOUDFLARE_ENV` must be set at build time, not deploy time (TanStack Start + Vite requirement)

**Cloudflare Workers Builds Documentation:**
- [Workers Builds Overview](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Git Integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)
- [Preview Deployments](https://developers.cloudflare.com/workers/ci-cd/builds/preview-deployments/)

**Testing Commands:**

```bash
# Smoke test after deployment
./scripts/smoke-test.sh staging https://pm-staging.solsystemlabs.com
./scripts/smoke-test.sh production https://pm.solsystemlabs.com

# Manual deployment (for comparison/troubleshooting)
npm run build
npx wrangler deploy --env staging
npx wrangler deploy --env production

# Check deployment status
npx wrangler deployments list --env staging
npx wrangler deployments list --env production
```

**Rollback Procedure:**

If a deployment introduces critical bugs:

1. Navigate to Cloudflare Dashboard → Workers & Pages → printfarm-manager
2. Click "View deployments"
3. Find previous successful deployment (check timestamp and commit)
4. Click "Rollback to this deployment"
5. Confirm rollback (takes ~30 seconds)
6. Verify application working via smoke test

**Environment Variable Security:**

- Never commit `DATABASE_URL` or API keys to version control
- Use Cloudflare secrets for sensitive values
- Set environment-specific secrets per environment
- Secrets are encrypted at rest and in transit

## Dev Agent Record

### Context Reference

- [Story Context XML](/home/taylor/projects/printfarm-manager/docs/story-context-1.4.xml)

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

# Story 1.2: Set Up Xata Database with Branching

Status: ContextReadyDraft

## Story

As a developer,
I want Xata database configured with branch-per-environment strategy,
so that dev/staging/production have isolated data and PR previews get dedicated branches.

## Acceptance Criteria

1. Xata project created with main database instance
2. Three persistent branches created: `dev`, `staging`, `production`
3. Database schema initialized (defer table definitions to Epic 2, just structure)
4. Xata CLI authenticated and configured locally
5. Environment variables set per environment pointing to correct Xata branch
6. Automated daily backups confirmed operational in Xata dashboard
7. PR preview branch auto-creation configured (verify in Story 1.4)

## Tasks / Subtasks

- [ ] Create Xata project and initialize (AC: #1, #3, #4)
  - [ ] Install Xata CLI globally
  - [ ] Authenticate with Xata: `xata auth login`
  - [ ] Initialize project: `xata init`
  - [ ] Choose region (us-east-1 or appropriate)
- [ ] Create environment branches (AC: #2)
  - [ ] Create dev branch
  - [ ] Create staging branch
  - [ ] Create production branch
  - [ ] Verify branches visible in Xata dashboard
- [ ] Configure Prisma for database access (AC: #3)
  - [ ] Create `prisma/schema.prisma` with basic datasource config
  - [ ] Configure PostgreSQL provider
  - [ ] Add Prisma client generator
- [ ] Set up environment-specific connection strings (AC: #5)
  - [ ] Add DATABASE_URL to `.dev.vars` for local development (dev branch)
  - [ ] Set DATABASE_URL secret for staging environment via wrangler
  - [ ] Set DATABASE_URL secret for production environment via wrangler
  - [ ] Add XATA_BRANCH variable to wrangler.jsonc env blocks
- [ ] Verify database connections (AC: #5)
  - [ ] Test local dev connection
  - [ ] Create health check API route that tests database connectivity
  - [ ] Verify connection strings point to correct branches
- [ ] Confirm backup configuration (AC: #6)
  - [ ] Navigate to Xata dashboard
  - [ ] Verify daily backups enabled
  - [ ] Confirm 7-day retention policy
- [ ] Document PR preview branch strategy (AC: #7)
  - [ ] Add note about auto-creation/deletion to documentation
  - [ ] Defer actual testing to Story 1.4 (CI/CD setup)

## Dev Notes

### Technical Approach

**Xata Project Setup:**
- Xata provides serverless Postgres-compatible database with automatic branching
- Branch-per-environment strategy ensures complete data isolation
- Prisma used as ORM for type-safe database access
- Connection strings stored as Cloudflare secrets (never in code)

**Branch Strategy:**
- `dev`: Local development branch (can be reset frequently)
- `staging`: Staging environment (semi-stable test data)
- `production`: Production environment (live data, never touched during dev)
- PR preview branches: Auto-created by Cloudflare during deployments (tested in Story 1.4)

**Database Schema:**
- This story only sets up infrastructure
- Actual schema definition happens in Epic 2, Story 2.1
- Initial schema.prisma contains only datasource and generator configuration

**Connection String Format:**
```
postgresql://[workspace]:[api-key]@[region].xata.sh/printfarm-manager:[branch]?sslmode=require
```

### Project Structure Notes

**Files to Create:**
- `/prisma/schema.prisma` - Prisma schema file with basic configuration
- `/.dev.vars` - Local environment variables (gitignored)

**Files to Modify:**
- `/wrangler.jsonc` - Add XATA_BRANCH variables to env blocks

**Environment Variables:**
- `DATABASE_URL` - Set as Cloudflare secret (per environment)
- `XATA_BRANCH` - Set in wrangler.jsonc vars (staging/production only)

### References

**Source Documents:**
- [Source: docs/tech-spec-epic-1.md, lines 168-308] - Complete technical specification for Story 1.2
- [Source: docs/epics.md, lines 60-81] - User story and acceptance criteria
- [Source: docs/solution-architecture.md, Database Architecture section] - Prisma schema structure and branching strategy

**Technical Standards:**
- Use Prisma as ORM for type-safe database access
- Xata provides automatic daily backups with 7-day retention on free tier
- All database credentials stored as secrets, never committed to version control

**Database Schema (Initial - Epic 2 will expand):**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Schema tables defined in Epic 2, Story 2.1
// This story only sets up infrastructure
```

**Testing Commands:**
```bash
# Test dev branch connection
npm run dev
# Access API route that logs database connection success

# Verify branches in Xata dashboard
# Navigate to: https://app.xata.io/workspaces/[workspace]/databases/printfarm-manager
# Confirm: dev, staging, production branches visible

# Test staging connection (after deployment in Story 1.4)
curl https://pm-staging.solsystemlabs.com/api/health
# Verify: Returns database connection status
```

## Dev Agent Record

### Context Reference

- `/home/taylor/projects/printfarm-manager/docs/story-context-1.1.2.xml` (Generated: 2025-10-16)

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

<!-- To be added during implementation -->

### Completion Notes List

<!-- To be added during implementation -->

### File List

<!-- To be added during implementation -->

# Epics Change Proposal: Cloudflare → Netlify Migration

**Document**: `/docs/epics.md`
**Change Type**: Complete rewrite of Epic 1 stories
**Scope**: Replace 6 Cloudflare-specific stories with Netlify equivalents

---

## Epic 1 Overview Update

**Location**: Lines 23-34

**OLD**:
```markdown
## Epic 1: Deployment & Operations Foundation

**Goal:** Establish production-ready deployment pipeline and observability infrastructure before any feature development begins.

**Business Value:** Enables efficient development workflow with proper environments, automated deployments, and debugging capabilities. Without this foundation, feature development becomes chaotic and error-prone.

**Success Criteria:**
- Three environments operational (dev/staging/production) with independent databases and R2 buckets
- Automated deployments working via Cloudflare Workers Builds
- PR preview URLs generating automatically
- Logs accessible in Cloudflare Dashboard with 100% request sampling
```

**NEW**:
```markdown
## Epic 1: Deployment & Operations Foundation

**Goal:** Establish production-ready deployment pipeline and observability infrastructure before any feature development begins.

**Business Value:** Enables efficient development workflow with proper environments, automated deployments, and debugging capabilities. Without this foundation, feature development becomes chaotic and error-prone.

**Success Criteria:**
- Three environments operational (dev/staging/production) with independent databases and R2 buckets
- Automated deployments working via Netlify Git integration
- PR deploy preview URLs generating automatically
- Logs accessible in Netlify Dashboard with function-level observability
```

---

## Story 1.1: Complete Rewrite

**Location**: Lines 35-55

**DELETE**: Entire "Configure Cloudflare Workers Environments" story

**REPLACE WITH**:

```markdown
### Story 1.1: Configure Netlify Deployment Environments

**As a** developer
**I want** three distinct Netlify deployment environments configured
**So that** I can develop locally, test in staging, and deploy to production safely

**Prerequisites:** None (first story)

**Acceptance Criteria:**
1. `netlify.toml` defines build configuration and environment contexts
2. Three environments configured: development (local), staging (master branch), production (production branch)
3. Environment-specific variables configured: `ENVIRONMENT` = "development"/"staging"/"production"
4. Node.js version pinned to v20 in build configuration
5. Local development runs with `npm run dev` using development environment
6. Documentation updated with Netlify deployment details
7. Custom domains configured: `pm-staging.solsystemlabs.com` (staging), `pm.solsystemlabs.com` (production)

**Technical Notes:**
- Use `netlify.toml` for build configuration
- Environment variables set via Netlify Dashboard (Site settings → Environment variables)
- TanStack Start's Netlify adapter handles build output automatically
```

---

## Story 1.2: Complete Rewrite

**Location**: Lines 57-79

**DELETE**: Entire "Set Up Xata Database with Branching" story

**REPLACE WITH**:

```markdown
### Story 1.2: Set Up Neon PostgreSQL Database

**As a** developer
**I want** Neon PostgreSQL configured with branch-per-environment strategy
**So that** dev/staging/production have isolated data and deploy previews get dedicated branches

**Prerequisites:** Story 1.1

**Acceptance Criteria:**
1. Neon project created for printfarm-manager
2. Three persistent branches created: `development`, `staging`, `production`
3. Database schema initialized (defer table definitions to Epic 2, just structure)
4. Neon CLI authenticated and configured locally (optional, not required for deployment)
5. Connection strings configured in Netlify environment variables per environment:
   - Development: Points to `development` branch
   - Staging (master): Points to `staging` branch
   - Production: Points to `production` branch
6. Automated daily backups confirmed operational in Neon dashboard
7. Deploy preview branches configured to use staging database (preview-specific branches optional for MVP)

**Technical Notes:**
- Neon provides PostgreSQL-compatible database with instant branching
- Database migrations handled via Prisma (standard generator, no WASM needed!)
- Connection strings stored as Netlify environment variables (never in code)
- Format: `postgresql://[user]:[password]@[host]/[database]?sslmode=require`
```

---

## Story 1.3: Update for Netlify Context

**Location**: Lines 81-101

**OLD**:
```markdown
### Story 1.3: Configure Cloudflare R2 Buckets

**As a** developer
**I want** separate R2 buckets for each environment
**So that** uploaded files don't mix between dev/staging/production

**Prerequisites:** Story 1.1

**Acceptance Criteria:**
1. Three R2 buckets created: `pm-dev-files`, `pm-staging-files`, `pm-files`
2. Each bucket has versioning enabled (for disaster recovery per NFR-12)
3. CORS configuration applied to allow uploads from application domains
4. Environment-specific bucket names configured in wrangler.jsonc bindings
5. Bucket access confirmed via test upload/download in each environment
6. Storage usage visible in Cloudflare Dashboard (manual monitoring per NFR-2)

**Technical Notes:**
- R2 free tier: 10GB storage, 1M class A ops/month, 10M class B ops/month
- Bucket bindings syntax: `[[r2_buckets]]` in wrangler.jsonc
```

**NEW**:
```markdown
### Story 1.3: Configure Cloudflare R2 Buckets and API Access

**As a** developer
**I want** separate R2 buckets for each environment with S3-compatible API access
**So that** uploaded files don't mix between dev/staging/production

**Prerequisites:** Story 1.1

**Acceptance Criteria:**
1. Three R2 buckets created: `pm-dev-files`, `pm-staging-files`, `pm-files`
2. Each bucket has versioning enabled (for disaster recovery per NFR-12)
3. CORS configuration applied to allow uploads from application domains
4. R2 API tokens created with read/write permissions for each bucket
5. Environment-specific bucket names and credentials configured in Netlify environment variables:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME` (environment-specific)
6. Bucket access confirmed via test upload/download using AWS SDK in each environment
7. Storage usage visible in Cloudflare Dashboard (manual monitoring per NFR-2)

**Technical Notes:**
- R2 free tier: 10GB storage, 1M class A ops/month, 10M class B ops/month
- Access R2 via S3-compatible API using `@aws-sdk/client-s3`
- Endpoint format: `https://[account-id].r2.cloudflarestorage.com`
- No Wrangler bindings needed—standard S3 SDK client configuration
```

---

## Story 1.4: Complete Rewrite

**Location**: Lines 103-126

**DELETE**: Entire "Implement Cloudflare Workers Builds CI/CD" story

**REPLACE WITH**:

```markdown
### Story 1.4: Implement Netlify Git-Based Deployment CI/CD

**As a** developer
**I want** automated deployments via Netlify Git integration
**So that** pushing to master/production branches automatically deploys to staging/production

**Prerequisites:** Stories 1.1, 1.2, 1.3

**Acceptance Criteria:**
1. GitHub repository connected to Netlify site
2. Build configuration set in `netlify.toml`: `npm run build` command, `.netlify` publish directory
3. Branch deployments configured:
   - `master` branch → staging site (`pm-staging.solsystemlabs.com`)
   - `production` branch → production site (`pm.solsystemlabs.com`)
4. Deploy previews enabled for all pull requests (isolated preview URLs)
5. Preview deployments use staging environment configuration
6. Deployment completes in ≤5 minutes from git push to live environment (per NFR-10)
7. Failed builds prevent deployment and send notifications
8. Build logs accessible in Netlify Dashboard

**Technical Notes:**
- Netlify automatically builds on push to any configured branch
- Deploy previews format: `deploy-preview-[pr-number]--pm-staging.netlify.app`
- TanStack Start's Netlify adapter handles build output (no manual configuration needed)
- Custom domains configured in Netlify DNS or external DNS with CNAME records
```

---

## Story 1.5: Update for Netlify Context

**Location**: Lines 128-150

**OLD**:
```markdown
### Story 1.5: Implement Logging and Observability

**As a** developer
**I want** comprehensive logging for all API requests and errors
**So that** I can debug issues in staging/production environments

**Prerequisites:** Story 1.4

**Acceptance Criteria:**
1. Cloudflare Workers logs accessible in Dashboard for all environments
2. All API route handlers log request method, path, status code, duration
3. Error responses logged with descriptive messages (never stack traces per NFR-6)
4. Performance metrics logged: upload times, extraction times, search query times (per NFR-9)
5. Environment indicator (dev/staging/production) logged with each request
6. Logs filterable by environment, status code, time range in Cloudflare Dashboard
7. 100% request sampling confirmed operational (observability config from Story 1.1)

**Technical Notes:**
- Use `console.log()`, `console.error()` - automatically captured by Cloudflare
- Structured logging preferred: `console.log(JSON.stringify({ event, data }))`
- Cloudflare retains logs for 24 hours on free tier
```

**NEW**:
```markdown
### Story 1.5: Implement Logging and Observability

**As a** developer
**I want** comprehensive logging for all API requests and errors
**So that** I can debug issues in staging/production environments

**Prerequisites:** Story 1.4

**Acceptance Criteria:**
1. Netlify Functions logs accessible in Dashboard for all environments
2. All API route handlers log request method, path, status code, duration
3. Error responses logged with descriptive messages (never stack traces per NFR-6)
4. Performance metrics logged: upload times, extraction times, search query times (per NFR-9)
5. Environment indicator (dev/staging/production) logged with each request
6. Logs filterable by function, time range, log level in Netlify Dashboard
7. Function execution duration visible in dashboard for performance monitoring

**Technical Notes:**
- Use `console.log()`, `console.error()` - automatically captured by Netlify Functions
- Structured logging preferred: `console.log(JSON.stringify({ event, data }))`
- Netlify retains logs for 1 hour on free tier (adequate for debugging recent issues)
- Cold start vs warm start metrics visible in dashboard
```

---

## Story 1.7: Minimal Changes

**Location**: Lines 152-174

**Changes Required**: Update references from "Cloudflare Dashboard" to "Cloudflare R2 Dashboard"

**OLD** (line 167):
```
7. Link to Cloudflare Dashboard for detailed usage analytics
```

**NEW** (line 167):
```
7. Link to Cloudflare R2 Dashboard for detailed usage analytics
```

**Technical Notes** (line 170): No changes needed - storage calculation remains same

---

## Summary

**Stories Rewritten**: 5 of 6 (Stories 1.1, 1.2, 1.3, 1.4, 1.5)
**Stories Updated**: 1 of 6 (Story 1.7 - minimal change)

**Key Changes by Story**:
- **1.1**: Cloudflare Workers environments → Netlify deployment contexts
- **1.2**: Xata database branching → Neon PostgreSQL branching
- **1.3**: Wrangler R2 bindings → S3 SDK with API tokens
- **1.4**: Cloudflare Workers Builds → Netlify Git deployments
- **1.5**: Cloudflare Dashboard logs → Netlify Functions logs
- **1.7**: Minor wording update (R2 Dashboard clarification)

**Functional Impact**: None - All stories achieve same goals with different implementation

**Timeline Impact**: Epic 1 remains 6-8 stories, 1-2 weeks duration

**Next Steps**: Apply changes to epics.md

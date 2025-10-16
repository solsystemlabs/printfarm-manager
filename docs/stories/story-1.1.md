# Story 1.1: Configure Cloudflare Workers Environments

Status: Draft

## Story

As a developer,
I want three distinct Cloudflare Workers environments configured in wrangler.jsonc,
so that I can develop locally, test in staging, and deploy to production safely.

## Acceptance Criteria

1. `wrangler.jsonc` defines three environments: development (pm-dev), staging (pm-staging), production (pm)
2. Each environment has unique worker name to prevent conflicts
3. Environment-specific variables configured: `ENVIRONMENT` = "development"/"staging"/"production"
4. Smart Placement enabled in wrangler.jsonc (`placement: { mode: "smart" }`)
5. Observability configured with 100% head sampling rate
6. Local development runs with `npm run dev` using pm-dev configuration
7. Documentation updated with environment configuration details

## Tasks / Subtasks

- [ ] Create/update wrangler.jsonc with environment configurations (AC: #1, #2, #3)
  - [ ] Define base configuration for pm-dev (development)
  - [ ] Add env.staging block for pm-staging worker
  - [ ] Add env.production block for pm worker
  - [ ] Set ENVIRONMENT variable for each environment
  - [ ] Configure custom domain routes for staging/production
- [ ] Enable Smart Placement and Observability (AC: #4, #5)
  - [ ] Add `placement: { mode: "smart" }` to base config
  - [ ] Add `observability: { enabled: true, head_sampling_rate: 1 }` to base config
- [ ] Verify local development configuration (AC: #6)
  - [ ] Run `npm run dev` and verify pm-dev worker name in output
  - [ ] Test that ENVIRONMENT variable is accessible via getContext
- [ ] Test staging/production configurations (AC: #1, #2, #3)
  - [ ] Run `npx wrangler deploy --env staging --dry-run`
  - [ ] Run `npx wrangler deploy --env production --dry-run`
  - [ ] Verify correct worker names and variables in dry-run output
- [ ] Update documentation (AC: #7)
  - [ ] Add environment configuration details to CLAUDE.md or separate doc
  - [ ] Document wrangler.jsonc structure and purpose of each environment

## Dev Notes

### Technical Approach

**Single wrangler.jsonc with Environment Blocks:**
- Base configuration serves local development (pm-dev)
- `env.staging` and `env.production` blocks override base settings
- Each environment gets unique worker name and ENVIRONMENT variable
- Aligns with Cloudflare Workers best practices for multi-environment setup

**Key Configuration Points:**
- Smart Placement optimizes worker execution location based on subrequest patterns
- 100% head sampling (observability) enables comprehensive request tracing in Cloudflare logs
- Custom domain routes ensure staging and production are accessible at their respective URLs

**Testing Strategy:**
- Local: `npm run dev` should show pm-dev worker
- Dry-run deployments verify configuration without actual deployment
- Real deployments tested in Story 1.4 (CI/CD setup)

### Project Structure Notes

**Files to Create/Modify:**
- `/wrangler.jsonc` - Primary configuration file (should already exist from TanStack Start template)
- `/docs/DEPLOYMENT.md` or add section to existing docs - Environment setup documentation

**Alignment with Existing Structure:**
- TanStack Start generates `dist/server/wrangler.json` during build (via Vite)
- Our `wrangler.jsonc` serves as source configuration
- `CLOUDFLARE_ENV` environment variable (set during CI/CD) determines which env config is used

### References

**Source Documents:**
- [Source: docs/tech-spec-epic-1.md, lines 63-165] - Complete technical specification for Story 1.1
- [Source: docs/epics.md, lines 37-57] - User story and acceptance criteria
- [Source: CLAUDE.md, Cloudflare Workers Deployment section] - Environment configuration guidance and wrangler.jsonc structure

**Technical Standards:**
- Use JSONC format (JSON with comments) for wrangler.jsonc
- Follow TanStack Start conventions for Worker configuration
- Custom domains already configured: pm-staging.solsystemlabs.com, pm.solsystemlabs.com

**Example Configuration Structure (from tech-spec):**
```jsonc
{
  "name": "pm-dev",
  "main": "dist/server/index.mjs",
  "compatibility_date": "2025-01-15",
  "vars": {
    "ENVIRONMENT": "development"
  },
  "placement": {
    "mode": "smart"
  },
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  },
  "env": {
    "staging": {
      "name": "pm-staging",
      "vars": {
        "ENVIRONMENT": "staging"
      },
      "routes": [
        {
          "pattern": "pm-staging.solsystemlabs.com",
          "custom_domain": true
        }
      ]
    },
    "production": {
      "name": "pm",
      "vars": {
        "ENVIRONMENT": "production"
      },
      "routes": [
        {
          "pattern": "pm.solsystemlabs.com",
          "custom_domain": true
        }
      ]
    }
  }
}
```

**Testing Commands:**
```bash
# Test local dev environment
npm run dev
# Verify: Worker starts with pm-dev name

# Test staging deployment (dry-run)
npm run build
npx wrangler deploy --env staging --dry-run
# Verify: Shows pm-staging worker name

# Test production deployment (dry-run)
npx wrangler deploy --env production --dry-run
# Verify: Shows pm worker name
```

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML/JSON will be added here by context workflow -->

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

<!-- To be added during implementation -->

### Completion Notes List

<!-- To be added during implementation -->

### File List

<!-- To be added during implementation -->

# Deployment Guide

This document describes the automated deployment workflows for the Print Farm Manager application using Cloudflare Workers Builds.

## Overview

Print Farm Manager uses **Cloudflare Workers Builds** for CI/CD, providing automated deployments triggered by Git pushes. All builds and deployments are handled automatically by Cloudflare's native Git integration.

## Environments

| Environment | Worker Name | Domain | Branch | Auto-Deploy |
|-------------|-------------|--------|--------|-------------|
| Development | `pm-dev` | localhost:3000 | (local only) | No |
| Staging | `pm-staging` | pm-staging.solsystemlabs.com | `master` | Yes |
| Production | `pm` | pm.solsystemlabs.com | `production` | Yes |

## Deployment Workflows

### 1. Pull Request Previews (Isolated Testing)

When you create a pull request:

```bash
git checkout -b feature/my-feature
git push -u origin feature/my-feature
# Create PR via GitHub UI or gh CLI
```

**What happens:**
1. Cloudflare detects the PR and starts a build
2. Runs: `npm run build` with `CLOUDFLARE_ENV=staging`
3. TanStack Start/Vite generates `dist/server/wrangler.json` for staging config
4. Deploys using: `npx wrangler versions upload --config dist/server/wrangler.json --env staging`
5. Generates isolated preview URL: `feature-my-feature-pm-staging.<subdomain>.workers.dev`
6. Posts preview URL as a PR comment
7. Each push to the PR branch updates the same preview URL

**Key characteristics:**
- **Isolated**: Preview URLs do NOT affect the live staging environment
- **Temporary**: Deleted automatically when PR is closed/merged
- **Same config**: Uses staging configuration but isolated deployment
- **Fast**: Typically completes in 3-5 minutes

**Testing preview deployments:**
```bash
# URL will be posted as a PR comment, or find it in Cloudflare Dashboard
# → Workers & Pages → pm-staging → Deployments → Preview Deployments

# Run smoke tests against preview
./scripts/smoke-test.sh staging <preview-url>
```

### 2. Staging Deployment (master branch)

When you merge to master:

```bash
git checkout master
git pull
git merge feature/my-feature
git push
```

**What happens:**
1. Cloudflare detects push to `master`
2. Runs: `npm run build` with `CLOUDFLARE_ENV=staging`
3. TanStack Start/Vite generates `dist/server/wrangler.json` with `name: "pm-staging"`
4. Deploys using: `npx wrangler deploy --config dist/server/wrangler.json`
5. Updates live staging at https://pm-staging.solsystemlabs.com

**Verification:**
```bash
# Run smoke tests
./scripts/smoke-test.sh staging https://pm-staging.solsystemlabs.com

# Check deployment status
npx wrangler deployments list --name pm-staging

# View logs
npx wrangler tail --name pm-staging
```

### 3. Production Deployment (production branch)

When you're ready to promote staging to production:

```bash
git checkout production
git pull
git merge master
git push
```

**What happens:**
1. Cloudflare detects push to `production`
2. Runs: `npm run build` with `CLOUDFLARE_ENV=production`
3. TanStack Start/Vite generates `dist/server/wrangler.json` with `name: "pm"`
4. Deploys using: `npx wrangler deploy --config dist/server/wrangler.json`
5. Updates live production at https://pm.solsystemlabs.com

**Verification:**
```bash
# Run smoke tests
./scripts/smoke-test.sh production https://pm.solsystemlabs.com

# Check deployment status
npx wrangler deployments list --name pm

# View logs
npx wrangler tail --name pm
```

## Build Process

### Build Timeline

Per NFR-10, deployments complete in ≤5 minutes:

| Phase | Duration | Description |
|-------|----------|-------------|
| Git clone | 10-20s | Clone repository from GitHub |
| npm install | 1-2m | Install dependencies (cached) |
| npm run build | 30-60s | Build application with TanStack Start/Vite |
| wrangler deploy | 30-60s | Upload and deploy to Cloudflare edge |
| Edge propagation | 10-30s | Propagate to global edge network |
| **Total** | **3-5m** | Typical end-to-end deployment |

### Build Configuration

Each environment has specific build-time configuration:

**Staging (master + PRs):**
- `CLOUDFLARE_ENV=staging` (set in Cloudflare Dashboard build variables)
- Generates worker name: `pm-staging`
- Binds to R2 bucket: `pm-staging-files`
- Sets runtime vars: `ENVIRONMENT=staging`, `XATA_BRANCH=staging`

**Production:**
- `CLOUDFLARE_ENV=production` (set in Cloudflare Dashboard build variables)
- Generates worker name: `pm`
- Binds to R2 bucket: `pm-files`
- Sets runtime vars: `ENVIRONMENT=production`, `XATA_BRANCH=production`

### Why CLOUDFLARE_ENV is Required

TanStack Start uses Vite, which generates the `wrangler.json` configuration during the build process. The `CLOUDFLARE_ENV` environment variable tells Vite which environment section from `wrangler.jsonc` to use:

- `CLOUDFLARE_ENV=staging` → Vite generates config with `name: "pm-staging"`
- `CLOUDFLARE_ENV=production` → Vite generates config with `name: "pm"`

This must be set at **build time** (not deploy time) because the configuration is baked into `dist/server/wrangler.json` during the build. The traditional `--env` flag doesn't work with Vite-based projects.

## Rollback Procedures

### Quick Rollback via Dashboard

If a deployment introduces critical bugs:

1. Navigate to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → [worker name]
2. Click **"View deployments"**
3. Find the previous successful deployment (check timestamp and commit hash)
4. Click **"Rollback to this deployment"**
5. Confirm rollback (~30 seconds to complete)
6. Verify with smoke tests: `./scripts/smoke-test.sh <env> <url>`

### Rollback via Git

For more controlled rollback with Git history:

```bash
# Find the commit to revert to
git log --oneline

# Option 1: Revert specific commits
git revert <bad-commit-hash>
git push

# Option 2: Reset to previous commit (use with caution)
git checkout production  # or master for staging
git reset --hard <good-commit-hash>
git push --force  # Only use in emergency situations

# Cloudflare will auto-deploy the reverted code
```

⚠️ **Warning**: Force pushes should only be used in emergency situations when quick rollback via Dashboard isn't sufficient.

## Smoke Testing

After any deployment, run smoke tests to verify critical functionality:

```bash
# Staging
./scripts/smoke-test.sh staging https://pm-staging.solsystemlabs.com

# Production
./scripts/smoke-test.sh production https://pm.solsystemlabs.com

# Preview URL
./scripts/smoke-test.sh staging <preview-url>
```

The smoke test script verifies:
- ✅ Health check endpoint (`/api/health`)
- ✅ Environment variable configuration
- ✅ Database connectivity (when configured)
- ✅ R2 storage operations (dev/staging only)

## Monitoring Deployments

### Cloudflare Dashboard

**View build logs:**
1. Navigate to Workers & Pages → [worker name] → Deployments
2. Click on specific deployment to view logs
3. Build logs show npm install, build, and deploy output
4. Deployment status: Success, Failed, or In Progress

**View runtime logs:**
1. Navigate to Workers & Pages → [worker name] → Logs
2. Real-time logs from deployed worker
3. All `console.log()`, `console.error()`, etc. captured
4. Filtering and search available

### GitHub Integration

**PR comments:**
- Cloudflare automatically posts deployment status
- Preview URL included when build succeeds
- Build errors shown with logs link

**Commit status checks:**
- Green checkmark when build succeeds
- Red X when build fails
- Click for detailed logs

### CLI Monitoring

```bash
# List recent deployments
npx wrangler deployments list --name pm-staging

# Stream live logs
npx wrangler tail --name pm-staging

# Stream logs with filtering
npx wrangler tail --name pm-staging --status error

# Check worker status
npx wrangler deployments status --name pm-staging
```

## Failed Build Handling

When a build fails:

1. **Deployment is prevented** - Failed builds never reach production/staging
2. **Notification in Dashboard** - Error visible in Workers & Pages → Deployments
3. **GitHub status check fails** - Red X on commit/PR
4. **No worker update** - Current deployment remains active

**Common failure causes:**
- TypeScript errors
- Test failures
- Build script errors
- Missing environment variables
- Dependency installation errors

**Resolution steps:**
1. Check build logs in Cloudflare Dashboard
2. Reproduce locally: `npm run build`
3. Fix the issue
4. Push fix to trigger new build

## Environment Promotion Strategy

Recommended workflow for safe deployments:

```
Feature Branch → PR Preview → Staging → Production
```

**Step 1: Development & PR Preview**
```bash
git checkout -b feature/my-feature
# ... make changes ...
git push -u origin feature/my-feature
# Create PR → Cloudflare creates preview URL
# Test preview URL thoroughly
```

**Step 2: Merge to Staging**
```bash
git checkout master
git merge feature/my-feature
git push
# Auto-deploys to staging
# Run smoke tests: ./scripts/smoke-test.sh staging https://pm-staging.solsystemlabs.com
# Perform QA testing
```

**Step 3: Promote to Production**
```bash
# Only after staging testing is complete
git checkout production
git merge master
git push
# Auto-deploys to production
# Run smoke tests: ./scripts/smoke-test.sh production https://pm.solsystemlabs.com
# Monitor for issues
```

## Manual Deployment (Emergency/Testing)

For emergency deployments or testing, you can deploy manually:

```bash
# Build locally
npm run build

# Deploy to staging
npx wrangler deploy --config dist/server/wrangler.json

# Deploy to production (use with caution)
CLOUDFLARE_ENV=production npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

⚠️ **Warning**: Manual deployments bypass CI/CD automation and should only be used in emergency situations.

## Secrets Management

**Never commit secrets to version control!**

### Local Development
Create `.dev.vars` file (gitignored):
```bash
# .dev.vars
DATABASE_URL=postgresql://...
SOME_API_KEY=sk-...
```

### Deployed Environments

**For non-sensitive values:**
- Use `vars` in `wrangler.jsonc` (e.g., `ENVIRONMENT`, `XATA_BRANCH`)

**For sensitive values:**
```bash
# Set secret for staging
npx wrangler secret put DATABASE_URL --name pm-staging
# Enter secret value when prompted

# Set secret for production
npx wrangler secret put DATABASE_URL --name pm
# Enter secret value when prompted
```

Secrets are:
- Encrypted at rest and in transit
- Never exposed in logs or Dashboard
- Accessible via `process.env` in your code

### R2 Bucket Bindings

R2 bucket bindings must be configured in the Cloudflare Dashboard for deployed workers. The buckets are already created, but the bindings aren't automatically applied from `wrangler.jsonc`.

**Configure R2 bindings:**

1. Navigate to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages
2. Select **pm-staging** worker → Settings → Bindings
3. Click **Add binding** → **R2 Bucket**
   - Variable name: `FILES_BUCKET`
   - R2 bucket: `pm-staging-files`
   - Click **Save**
4. Repeat for **pm** (production) worker:
   - Variable name: `FILES_BUCKET`
   - R2 bucket: `pm-files`
   - Click **Save**

**Verify bindings are working:**
```bash
# Test R2 operations on staging
curl https://pm-staging.solsystemlabs.com/api/test-r2

# Should return: {"success":true, ...}
```

## Performance Optimization

### Smart Placement

Smart Placement is enabled in `wrangler.jsonc`:
```jsonc
"placement": {
  "mode": "smart"
}
```

Benefits:
- Worker automatically runs closer to backend services it calls
- Reduces latency for multi-subrequest patterns
- Takes ~15 minutes after deployment to optimize
- No code changes needed

### Observability

Observability is enabled with 100% sampling:
```jsonc
"observability": {
  "enabled": true,
  "head_sampling_rate": 1
}
```

All requests are logged and traceable in the Cloudflare Dashboard.

## Troubleshooting

### Build Fails with "Module not found"
**Cause**: Missing dependency or incorrect import path
**Fix**:
```bash
npm install <missing-package>
# OR fix import path to use ~/* alias
```

### Build Succeeds but Worker Crashes
**Cause**: Runtime error or missing environment variable
**Fix**:
1. Check logs: Cloudflare Dashboard → Workers & Pages → [worker] → Logs
2. Test locally: `npm run dev`
3. Verify environment variables are set

### Preview URL Shows 404
**Cause**: Preview URLs not enabled for worker
**Fix**:
1. Navigate to Workers & Pages → [worker] → Settings → Domains & Routes
2. Enable Preview URLs

### Deployment Stuck "In Progress"
**Cause**: Rare Cloudflare platform issue
**Fix**:
1. Wait 10 minutes
2. If still stuck, trigger new deployment with empty commit:
   ```bash
   git commit --allow-empty -m "Trigger deployment"
   git push
   ```

### Environment Variable Not Available
**Cause**: Variable not set in Dashboard or wrong environment
**Fix**:
1. Verify in Cloudflare Dashboard → Workers & Pages → [worker] → Settings → Variables
2. Ensure variable is set for correct environment (staging vs production)
3. Redeploy after adding variable

## Additional Resources

- [Cloudflare Workers Builds Documentation](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [TanStack Start Documentation](https://tanstack.com/start)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [CLOUDFLARE_SETUP.md](../CLOUDFLARE_SETUP.md) - Detailed setup instructions
- [CLAUDE.md](../CLAUDE.md) - Project architecture and development guide

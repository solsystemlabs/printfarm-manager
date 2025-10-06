# Cloudflare Workers Builds Setup

This project uses Cloudflare's native Git integration (Workers Builds) for CI/CD instead of GitHub Actions.

## Setup Instructions

### 1. Connect GitHub Repository to Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Select your **pm-staging** worker
4. Go to **Settings** → **Builds & Deployments**
5. Click **Connect to Git**
6. Authorize Cloudflare to access your GitHub account
7. Select this repository: `printfarm-manager`

### 2. Configure Staging Environment (pm-staging worker)

In the **pm-staging** worker's build configuration:

- **Production Branch**: `master`
- **Build Command**: `npm run build`
- **Deploy Command**: `npx wrangler deploy --env staging`
- **Enable non-production branch builds**: Yes
- **Non-production branch deploy command**: `npx wrangler versions upload --env staging`

This will:
- Auto-deploy to staging when you push to `master`
- Create preview URLs for PRs (without deploying, just uploading versions)

### 3. Configure Production Environment (pm worker)

Repeat the setup for your **pm** (production) worker:

1. Navigate to **Workers & Pages** → **pm** worker
2. Go to **Settings** → **Builds & Deployments**
3. Click **Connect to Git**
4. Select the same repository

Configure:
- **Production Branch**: `production`
- **Build Command**: `npm run build`
- **Deploy Command**: `npx wrangler deploy --env production`
- **Enable non-production branch builds**: No (production worker only deploys from production branch)

### 4. Create Production Branch

```bash
# Create production branch from master
git checkout -b production
git push -u origin production

# To promote staging to production later:
git checkout production
git merge master
git push
```

## How It Works

### Pull Requests
- Cloudflare builds and uploads versions (preview URLs posted as PR comments)
- No actual deployment happens until merged

### Merge to Master
- Runs `npm run build`
- Deploys to `pm-staging` worker
- Accessible at https://pm-staging.solsystemlabs.com

### Merge to Production
- Runs `npm run build`
- Deploys to `pm` worker
- Accessible at https://pm.solsystemlabs.com

## Required Cloudflare Permissions

The GitHub integration requires:
- Read access to repository code
- Write access to post PR comments and commit statuses

These are granted when you authorize the Cloudflare GitHub App.

## Monitoring Builds

View build logs in:
- Cloudflare Dashboard → Workers & Pages → [worker name] → Deployments
- GitHub PR comments (automatic status updates)
- GitHub commit status checks

## Removing GitHub Actions

Since Cloudflare handles all CI/CD, you can remove:
- `.github/workflows/pipeline.yml`
- GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

These are no longer needed.

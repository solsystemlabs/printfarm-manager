# Cloudflare Workers Builds Setup

This project uses Cloudflare's native Git integration (Workers Builds) for CI/CD instead of GitHub Actions.

## Setup Instructions

### 1. Enable Preview URLs (Required First)

Before connecting Git repositories, enable Preview URLs for both workers:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Select your **pm-staging** worker
4. Go to **Settings** → **Domains & Routes**
5. Under **Preview URLs**, click **Enable**
6. Repeat steps 3-5 for the **pm** (production) worker

**Note**: Preview URLs must be enabled before PR previews will work.

### 2. Connect GitHub Repository to Cloudflare

#### For pm-staging worker:

1. Navigate to **Workers & Pages** → **pm-staging** worker
2. Go to **Settings** → **Build**
3. Click **Connect to Git** (or **Manage** if already connected)
4. Authorize Cloudflare to access your GitHub account (first time only)
5. Select this repository: `printfarm-manager`

#### For pm (production) worker:

1. Navigate to **Workers & Pages** → **pm** worker
2. Go to **Settings** → **Build**
3. Click **Connect to Git**
4. Select the same repository: `printfarm-manager`

### 3. Configure Staging Environment (pm-staging worker)

After connecting the repository, configure the build settings in **Settings → Build**:

#### Branch Control:
- **Production Branch**: `master`
- **Build Command**: `npm run build`
- **Deploy Command**: `npx wrangler deploy --config dist/server/wrangler.json`
- **☑️ Enable Pull Request Previews**: Checked
- **Non-production branch deploy command**: `npx wrangler versions upload --config dist/server/wrangler.json --env staging`

#### Environment Variables (Settings → Build → Environment Variables):
Add the following **build-time** environment variable:
- **Variable name**: `CLOUDFLARE_ENV`
- **Value**: `staging`

**Important**: This variable controls which Cloudflare environment configuration TanStack Start/Vite uses during the build. It must be set as a build environment variable, not in `wrangler.jsonc`.

**What this does**:
- Push to `master` → Auto-deploys to staging at `pm-staging.solsystemlabs.com`
- Pull requests → Creates isolated preview URLs (does NOT affect staging)
- Preview URLs are posted as comments on PRs automatically
- During build, Vite reads `CLOUDFLARE_ENV=staging` and generates the correct `wrangler.json` for the pm-staging worker

### 4. Configure Production Environment (pm worker)

In **Settings → Build** for the **pm** worker:

#### Branch Control:
- **Production Branch**: `production`
- **Build Command**: `npm run build`
- **Deploy Command**: `npx wrangler deploy --config dist/server/wrangler.json`
- **⬜ Enable Pull Request Previews**: Unchecked

#### Environment Variables (Settings → Build → Environment Variables):
Add the following **build-time** environment variable:
- **Variable name**: `CLOUDFLARE_ENV`
- **Value**: `production`

**Important**: This variable controls which Cloudflare environment configuration TanStack Start/Vite uses during the build. It must be set as a build environment variable, not in `wrangler.jsonc`.

**Note**: Leave PR previews disabled for production. The pm-staging worker handles all PR previews.

### 5. Create Production Branch

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

### Pull Requests (Isolated Preview Deployments)
- Cloudflare runs `npm run build` with `CLOUDFLARE_ENV=staging`
- TanStack Start/Vite generates `dist/server/wrangler.json` configured for the staging environment
- Uploads a version using `npx wrangler versions upload --config dist/server/wrangler.json --env staging`
- Generates a unique, isolated preview URL (format: `<branch-name>-pm-staging.<subdomain>.workers.dev`)
- Preview URL is posted as a comment on the PR
- **Important**: Preview URLs are completely isolated from staging - they do NOT affect `pm-staging.solsystemlabs.com`
- Same preview URL updates with each push to the PR branch

### Merge to Master (Staging Deployment)
- Cloudflare runs `npm run build` with `CLOUDFLARE_ENV=staging`
- TanStack Start/Vite generates `dist/server/wrangler.json` with worker name `pm-staging`
- Deploys using `npx wrangler deploy --config dist/server/wrangler.json`
- Updates the live staging worker at https://pm-staging.solsystemlabs.com

### Merge to Production (Production Deployment)
- Cloudflare runs `npm run build` with `CLOUDFLARE_ENV=production`
- TanStack Start/Vite generates `dist/server/wrangler.json` with worker name `pm`
- Deploys using `npx wrangler deploy --config dist/server/wrangler.json`
- Updates the live production worker at https://pm.solsystemlabs.com

### Why CLOUDFLARE_ENV is Required

TanStack Start uses Vite, which generates the `wrangler.json` configuration file during the build process. The `CLOUDFLARE_ENV` environment variable tells Vite which environment section from your `wrangler.jsonc` to use:

- `CLOUDFLARE_ENV=staging` → Vite generates config with `name: "pm-staging"`
- `CLOUDFLARE_ENV=production` → Vite generates config with `name: "pm"`

This must be set at **build time** (not deploy time) because the configuration is baked into `dist/server/wrangler.json` during the build. The traditional `--env` flag doesn't work with Vite-based projects for this reason.

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

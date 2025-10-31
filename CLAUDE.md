# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TanStack Start application - a type-safe, client-first, full-stack React framework built on TanStack Router. It's configured for deployment on Netlify.

## Development Commands

```sh
# Install dependencies (uses npm)
npm install

# Run development server (starts on http://localhost:3000)
npm run dev

# Build and type-check
npm run build

# Preview production build
npm run preview

# Testing
npm test              # Run tests in watch mode
npm run test:run      # Run tests once (for CI)

# Linting and Formatting
npm run lint          # Check code for lint errors
npm run lint:fix      # Fix auto-fixable lint errors
npm run format        # Format code with Prettier
npm run format:check  # Check code formatting (for CI)

# Deployment
npm run deploy        # Deploy using default wrangler config
npm run cf-typegen    # Generate Cloudflare Workers types
```

## Architecture

### Tech Stack
- **Frontend**: React 19, TanStack Router, TanStack Query (React Query)
- **Styling**: TailwindCSS with tailwind-merge
- **Build**: Vite with TypeScript
- **Testing**: Vitest with React Testing Library
- **Linting**: ESLint v9 (flat config) with TypeScript and React plugins
- **Formatting**: Prettier
- **Deployment**: Netlify Functions
- **HTTP Client**: redaxios (lightweight axios alternative)

### Project Structure

```
src/
├── routes/           # File-based routing
│   ├── __root.tsx    # Root layout with navigation, devtools, error boundaries
│   ├── api/          # Server-side API handlers (run on Cloudflare Workers)
│   ├── *.route.tsx   # Layout routes
│   └── *.tsx         # Page routes
├── components/       # Shared React components
├── utils/            # Utility functions and helpers
├── styles/           # CSS files
└── router.tsx        # Router configuration with QueryClient integration
```

### Key Architecture Patterns

**File-Based Routing**: Routes are automatically generated from `src/routes/` directory structure:
- `__root.tsx` - Root layout component
- `posts.route.tsx` - Layout route (wrapper)
- `posts.index.tsx` - Index route at `/posts`
- `posts.$postId.tsx` - Dynamic route at `/posts/:postId`
- `_pathlessLayout.tsx` - Pathless layout (wraps child routes without changing URL)
- `api/users.ts` - Server-side API route at `/api/users`

**Router + Query Integration**: `src/router.tsx` sets up TanStack Router with React Query SSR integration using `setupRouterSsrQueryIntegration()`. The QueryClient is provided via router context.

**Server-Side API Routes**: Routes in `src/routes/api/` define server-side handlers that run on Cloudflare Workers. Use `server.handlers` object with HTTP methods (GET, POST, etc).

**Path Aliases**: TypeScript configured with `~/*` alias mapping to `src/*`

**Route Tree Generation**: `src/routeTree.gen.ts` is auto-generated - do not manually edit

## TypeScript Configuration

- Strict mode enabled
- Path alias: `~/*` → `src/*`
- Target: ES2022
- JSX: react-jsx (React 19 automatic runtime)

## Netlify Deployment

This project uses **Netlify's Git-based deployments** for CI/CD. All deployments are handled automatically by Netlify when you push to specific branches.

### Environments
Three deployment environments configured:

- **Development**: Local development via `npm run dev`
- **Staging**: `pm-staging.solsystemlabs.com` (auto-deploy on push to `master`)
- **Production**: `pm.solsystemlabs.com` (auto-deploy on push to `production`)

### Configuration

Netlify configuration is defined in `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = ".netlify"

[build.environment]
  NODE_VERSION = "20"

# Staging site (master branch)
[context.master]
  environment = { ENVIRONMENT = "staging" }

# Production site (production branch)
[context.production]
  environment = { ENVIRONMENT = "production" }

# Deploy Previews (PR branches)
[context.deploy-preview]
  environment = { ENVIRONMENT = "staging" }
```

**TanStack Start + Netlify**: TanStack Start's Netlify adapter automatically generates the correct build output for Netlify Functions (Node.js runtime).

### Deployment Strategy

**Pull Requests (Deploy Previews)**:
- Netlify runs: `npm run build`
- TanStack Start generates Netlify Functions bundle
- Generates isolated preview URL (e.g., `deploy-preview-123--pm-staging.netlify.app`)
- Preview URL posted as comment on PR
- **Preview URLs are completely isolated from staging** - they do NOT affect the live staging environment
- Same preview URL updates with each commit to the PR branch
- Previews are deleted when PR is closed/merged

**Push to `master` branch (Staging Deployment)**:
- Netlify runs: `npm run build`
- Deploys to: https://pm-staging.solsystemlabs.com
- Updates live staging environment

**Push to `production` branch (Production Deployment)**:
- Netlify runs: `npm run build`
- Deploys to: https://pm.solsystemlabs.com
- Updates live production environment

**Promoting staging to production**:
```bash
git checkout production
git merge master
git push
```

### Deploy Previews vs Environments

**Deploy Previews** (PR branches):
- Temporary, isolated deployments
- Format: `deploy-preview-[pr-number]--pm-staging.netlify.app`
- Automatically created for each PR
- Do NOT affect staging or production
- Public by default (can be password-protected in Netlify settings)

**Staging Environment** (master branch):
- Persistent deployment at `pm-staging.solsystemlabs.com`
- Updated only when merging to `master`
- Used for final QA before production

**Production Environment** (production branch):
- Persistent deployment at `pm.solsystemlabs.com`
- Updated only when merging to `production`
- Live environment serving real users

### Setup Instructions

1. **Connect Repository to Netlify**:
   - Log in to Netlify Dashboard
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub repository
   - Configure build settings:
     - Build command: `npm run build`
     - Publish directory: `.netlify`
     - Production branch: `production`

2. **Configure Custom Domains**:
   - Staging site: Add `pm-staging.solsystemlabs.com`
   - Production site: Add `pm.solsystemlabs.com`
   - Configure DNS records as instructed by Netlify

3. **Set Branch Deploys**:
   - Enable branch deploys for `master` (staging)
   - Enable deploy previews for pull requests

## Working with Netlify Functions

### Accessing Environment Variables in API Routes

Environment variables are accessed via `process.env` in Netlify Functions:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/example')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Access environment variables
        const environment = process.env.ENVIRONMENT // "development", "staging", or "production"

        // Access Cloudflare R2 via environment variables (see R2 section below)
        const r2AccountId = process.env.R2_ACCOUNT_ID
        const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
        const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY

        console.log(`API called in ${environment} environment`)

        return json({ environment })
      },
    },
  },
})
```

### Available Environment Variables

Environment variables are configured in Netlify Dashboard (Site settings → Environment variables):

**System Environment Variables** (set in netlify.toml):
- **`ENVIRONMENT`**: Current deployment environment
  - `"development"` - Local development (`npm run dev`)
  - `"staging"` - Staging deployment (`pm-staging.solsystemlabs.com`)
  - `"production"` - Production deployment (`pm.solsystemlabs.com`)

**Cloudflare R2 Environment Variables** (set in Netlify Dashboard):
- `R2_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 API token access key
- `R2_SECRET_ACCESS_KEY` - R2 API token secret
- `R2_BUCKET_NAME` - Environment-specific bucket name

**Database Environment Variables** (set in Netlify Dashboard):
- `DATABASE_URL` - Neon PostgreSQL connection string (environment-specific)

### Accessing Cloudflare R2 from Netlify Functions

Cloudflare R2 is accessed via the S3-compatible API using AWS SDK:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// Upload file to R2
const uploadCommand = new PutObjectCommand({
  Bucket: process.env.R2_BUCKET_NAME,
  Key: 'models/example.stl',
  Body: fileBuffer,
  ContentType: 'application/octet-stream',
  ContentDisposition: 'attachment; filename="example.stl"',
})

await r2Client.send(uploadCommand)

// Generate public URL
const r2Url = `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/models/example.stl`
```

**R2 Bucket Configuration**:
- Development: `pm-dev-files`
- Staging: `pm-staging-files`
- Production: `pm-files`

Set the appropriate bucket name in Netlify environment variables for each deployment context.

### Observability & Logging

**Netlify Functions Logging**:
- Local: View in terminal during `npm run dev`
- Deployed: Netlify Dashboard → Functions → [function name] → Logs
- All `console.log()`, `console.error()`, etc. are automatically captured
- Logs retained for 1 hour on free tier, 30 days on paid tiers

**Log Filtering**:
- Filter by log level (info, warn, error)
- Filter by time range
- Search logs by text

**Performance Monitoring**:
- Function execution duration visible in Netlify Dashboard
- Cold start vs warm start metrics
- Invocation count per function

### Netlify Functions Limits

**Free Tier Limits** (relevant for MVP):
- **Runtime**: 10 seconds per invocation
- **Memory**: 1024 MB (1 GB) per function
- **Invocations**: 125,000 per month
- **Execution time**: 100 hours per month

**Key Differences from Cloudflare Workers**:
- ✅ **Much higher memory**: 1 GB vs 128 MB (supports large file processing)
- ✅ **Standard Node.js runtime**: No WASM compilation needed
- ⚠️ **Shorter timeout**: 10s vs 30s (still adequate for most operations)
- ⚠️ **Invocation limits**: 125k/month vs unlimited (acceptable for MVP)

### Adding Secrets

For sensitive values (API keys, tokens, database passwords):

**Via Netlify Dashboard** (recommended):
1. Go to Site settings → Environment variables
2. Add variable with key and value
3. Select deployment contexts: Production, Deploy Previews, Branch deploys
4. Variable automatically injected into `process.env`

**Via Netlify CLI** (for local development):
```bash
# Link to Netlify site
netlify link

# Set environment variable
netlify env:set MY_SECRET "secret_value_here"

# List environment variables
netlify env:list
```

**For local development only** (`.env.local` file):
```bash
# Never commit this file!
MY_SECRET=secret_value_here
DATABASE_URL=postgresql://localhost/mydb
```

Access secrets via `process.env`:
```typescript
const secret = process.env.MY_SECRET
const dbUrl = process.env.DATABASE_URL
```

### Database Access (Neon PostgreSQL)

**Connection String Format**:
```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

**Neon Database Branching**:
- **Main branch**: Production database
- **Development branch**: For local development
- **Preview branches**: Auto-created for deploy previews (optional)

**Setting up Neon for each environment**:
1. Create Neon project
2. Create branches: `main` (production), `staging`, `development`
3. Copy connection strings from Neon dashboard
4. Add to Netlify environment variables:
   - Production context: Production database connection string
   - Deploy previews: Staging database connection string

**Prisma Configuration**:
```typescript
// Use Neon's standard PostgreSQL generator (no WASM needed!)
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Deployment Checklist

Before first deployment:

- [ ] Repository connected to Netlify
- [ ] Custom domains configured (pm-staging.solsystemlabs.com, pm.solsystemlabs.com)
- [ ] Branch deploys enabled: `master` → staging, `production` → production
- [ ] Deploy previews enabled for PRs
- [ ] Environment variables set:
  - [ ] `ENVIRONMENT` (in netlify.toml)
  - [ ] `R2_ACCOUNT_ID`
  - [ ] `R2_ACCESS_KEY_ID`
  - [ ] `R2_SECRET_ACCESS_KEY`
  - [ ] `R2_BUCKET_NAME`
  - [ ] `DATABASE_URL`
- [ ] R2 buckets created and accessible
- [ ] Neon database branches created
- [ ] Test deployment succeeds

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TanStack Start application - a type-safe, client-first, full-stack React framework built on TanStack Router. It's configured for deployment on Cloudflare Workers.

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
- **Deployment**: Cloudflare Workers (via Wrangler)
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

## Cloudflare Workers Deployment

This project uses **Cloudflare Workers Builds** (native Git integration) for CI/CD. All deployments are handled automatically by Cloudflare when you push to specific branches.

### Environments
Two deployment environments configured in `wrangler.jsonc`:

- **Development**: `pm-dev` worker (local development via `npm run dev`)
- **Staging**: `pm-staging` worker → `pm-staging.solsystemlabs.com` (auto-deploy on push to `master`)
- **Production**: `pm` worker → `pm.solsystemlabs.com` (auto-deploy on push to `production`)

### Configuration
All environments are defined in a single `wrangler.jsonc` file using Wrangler environments:
```jsonc
{
  "name": "pm-dev",  // Default for local development
  "env": {
    "staging": { "name": "pm-staging", ... },
    "production": { "name": "pm", ... }
  }
}
```

### Deployment Strategy

**Pull Requests (Isolated Previews)**:
- Cloudflare runs: `npm run build`
- Uploads via: `npx wrangler versions upload --env staging`
- Generates isolated preview URL (e.g., `feature-branch-pm-staging.<subdomain>.workers.dev`)
- Preview URL posted as comment on PR
- **Preview URLs are completely isolated from staging** - they do NOT affect the live staging environment
- Same preview URL updates with each commit to the PR branch
- Previews are deleted when PR is closed/merged

**Push to `master` branch (Staging Deployment)**:
- Cloudflare runs: `npm run build`
- Deploys via: `npx wrangler deploy --env staging`
- Updates live staging: https://pm-staging.solsystemlabs.com

**Push to `production` branch (Production Deployment)**:
- Cloudflare runs: `npm run build`
- Deploys via: `npx wrangler deploy --env production`
- Updates live production: https://pm.solsystemlabs.com

**Promoting staging to production**:
```bash
git checkout production
git merge master
git push
```

### Preview URLs vs Environments

**Preview URLs** (PR branches):
- Temporary, isolated deployments
- Format: `<branch-name>-pm-staging.<subdomain>.workers.dev`
- Automatically created for each PR (when "Enable Pull Request Previews" is checked)
- Do NOT affect staging or production
- Public by default (can be protected with Cloudflare Access)

**Staging Environment** (master branch):
- Persistent deployment at `pm-staging.solsystemlabs.com`
- Updated only when merging to `master`
- Used for final QA before production

**Production Environment** (production branch):
- Persistent deployment at `pm.solsystemlabs.com`
- Updated only when merging to `production`
- Live environment serving real users

### Setup Instructions
See `CLOUDFLARE_SETUP.md` for detailed instructions on connecting your GitHub repository to Cloudflare Workers Builds.

## Working with Cloudflare Workers Context

### Accessing Environment Variables in API Routes

To access Cloudflare environment variables and bindings in your server-side API routes, use `getContext('cloudflare')` from `vinxi/http`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'

export const Route = createFileRoute('/api/example')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Access Cloudflare context
        const cf = getContext('cloudflare')

        // Access environment variables
        const environment = cf.env.ENVIRONMENT // "development", "staging", or "production"

        // Access other Cloudflare bindings (KV, R2, D1, etc.) when configured
        // const db = cf.env.DB
        // const bucket = cf.env.MY_BUCKET

        console.log(`API called in ${environment} environment`)

        return json({ environment })
      },
    },
  },
})
```

### Available Environment Variables

The following environment variables are configured in `wrangler.jsonc`:

- **`ENVIRONMENT`**: Current deployment environment
  - `"development"` - Local development (`npm run dev`)
  - `"staging"` - Staging deployment (`pm-staging.solsystemlabs.com`)
  - `"production"` - Production deployment (`pm.solsystemlabs.com`)

### Observability & Logging

**Observability is enabled** with 100% request sampling in `wrangler.jsonc`:
```jsonc
"observability": {
  "enabled": true,
  "head_sampling_rate": 1
}
```

**Accessing logs**:
- Local: View in terminal during `npm run dev`
- Deployed: Cloudflare Dashboard → Workers & Pages → [worker name] → Logs
- All `console.log()`, `console.error()`, etc. are automatically captured

**Note**: TanStack Start currently has limitations accessing Cloudflare context in SSR loaders. The `getContext('cloudflare')` approach works reliably in:
- API route handlers (`src/routes/api/*.ts`)
- Server functions called from client-side code

### Smart Placement

**Smart Placement is enabled** in `wrangler.jsonc`:
```jsonc
"placement": {
  "mode": "smart"
}
```

This automatically optimizes where your worker executes:
- If your worker makes multiple subrequests to backend services, it will run closer to those backends
- No code changes needed - it analyzes traffic patterns automatically
- Takes ~15 minutes after deployment to start optimizing

### Adding Secrets

For sensitive values (API keys, tokens, etc.), **never use `vars` in `wrangler.jsonc`**. Use Wrangler secrets instead:

```bash
# For local development
echo "SECRET_VALUE" > .dev.vars
# Add to .dev.vars file:
# MY_SECRET=secret_value_here

# For staging
npx wrangler secret put MY_SECRET --env staging

# For production
npx wrangler secret put MY_SECRET --env production
```

Access secrets the same way as environment variables:
```typescript
const cf = getContext('cloudflare')
const secret = cf.env.MY_SECRET
```

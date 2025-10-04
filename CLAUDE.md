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

### Environments
Two deployment environments configured:
- **Staging**: `pm-staging` worker → `pm-staging.solsystemlabs.com` (auto-deploy on master)
- **Production**: `pm` worker → `pm.solsystemlabs.com` (manual trigger or after staging)

### Configuration Files
- `wrangler.staging.jsonc` - Staging worker configuration
- `wrangler.production.jsonc` - Production worker configuration

Both configs:
- Node.js compatibility enabled
- Use `@tanstack/react-start/server-entry` as main entry point
- Custom domains configured with Cloudflare

## CI/CD Pipeline

### GitHub Actions Workflows
1. **CI** (`.github/workflows/ci.yml`) - Runs on all PRs and pushes to master
   - Parallel jobs: lint, typecheck, test, build

2. **Deploy to Staging** (`.github/workflows/deploy-staging.yml`)
   - Triggers after successful CI on master branch
   - Deploys to `pm-staging.solsystemlabs.com`

3. **Deploy to Production** (`.github/workflows/deploy-production.yml`)
   - Triggers manually via workflow_dispatch OR after successful staging deployment
   - Requires GitHub environment approval (production environment)
   - Deploys to `pm.solsystemlabs.com`

### Required GitHub Secrets
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers Deploy permission
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID

### GitHub Environment Setup
Create a `production` environment in repository settings with required reviewers for deployment approval.

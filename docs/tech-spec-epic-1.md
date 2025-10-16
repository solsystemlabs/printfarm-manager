# Technical Specification: Epic 1 - Deployment & Operations Foundation

**Project:** printfarm-manager
**Epic:** 1 - Deployment & Operations Foundation
**Date:** 2025-10-15
**Status:** Ready for Implementation
**Estimated Duration:** 1-2 weeks

---

## Executive Summary

Epic 1 establishes the infrastructure foundation required for all subsequent feature development. This includes configuring three isolated environments (development, staging, production) with independent Cloudflare Workers, Xata database branches, and R2 storage buckets. The epic also implements comprehensive logging/observability and UI components for environment visibility and storage monitoring.

**Critical Success Factors:**
- Three environments fully operational before Epic 2 begins
- Automated CI/CD pipeline with PR preview capabilities
- 100% observability with structured logging
- Environment safety mechanisms (visual indicators to prevent production mistakes)

---

## Table of Contents

1. [Epic Overview](#epic-overview)
2. [Stories Breakdown](#stories-breakdown)
3. [Implementation Sequence](#implementation-sequence)
4. [Technical Approach](#technical-approach)
5. [Acceptance Criteria](#acceptance-criteria)
6. [Testing Strategy](#testing-strategy)
7. [Risks and Mitigations](#risks-and-mitigations)
8. [Code Examples](#code-examples)

---

## Epic Overview

### Goal
Establish production-ready deployment pipeline and observability infrastructure before any feature development begins.

### Business Value
- **Efficiency**: Developers can safely iterate in dev, test in staging, and confidently deploy to production
- **Safety**: Isolated environments prevent data contamination and production accidents
- **Debuggability**: Comprehensive logging enables rapid issue diagnosis
- **Transparency**: Storage monitoring prevents surprise overage costs

### Success Criteria
- ✅ Three environments operational with independent databases and R2 buckets
- ✅ Automated deployments working via Cloudflare Workers Builds
- ✅ PR preview URLs generating automatically without affecting staging
- ✅ Logs accessible in Cloudflare Dashboard with 100% request sampling
- ✅ Environment indicator visible in UI footer
- ✅ Storage dashboard showing usage against free tier limits

### Dependencies
**Prerequisites:** None (this is the foundation epic)
**Blocks:** Epic 2 (File Storage), Epic 3 (Metadata), Epic 4 (Products), Epic 5 (Search)

---

## Stories Breakdown

### Story 1.1: Configure Cloudflare Workers Environments

**Priority:** CRITICAL
**Complexity:** Low
**Estimated Effort:** 2-4 hours

#### User Story
**As a** developer
**I want** three distinct Cloudflare Workers environments configured in wrangler.jsonc
**So that** I can develop locally, test in staging, and deploy to production safely

#### Technical Requirements

1. **Single wrangler.jsonc with Environment Blocks**
   - Default environment: `pm-dev` (local development)
   - Staging environment: `pm-staging` (master branch)
   - Production environment: `pm` (production branch)

2. **Environment-Specific Variables**
   - `ENVIRONMENT` variable set to "development"/"staging"/"production"
   - Used for logging, environment indicator, and conditional behavior

3. **Observability Configuration**
   - Enable 100% head sampling for comprehensive request tracing
   - `observability.enabled = true`, `head_sampling_rate = 1`

4. **Smart Placement**
   - Enable Smart Placement to optimize worker execution location
   - `placement.mode = "smart"`

#### Implementation Details

**File:** `/wrangler.jsonc`

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

#### Acceptance Criteria
- [x] wrangler.jsonc exists with three environment configurations
- [x] Local development (`npm run dev`) uses pm-dev configuration
- [x] Each environment has unique worker name
- [x] ENVIRONMENT variable correctly set per environment
- [x] Smart Placement enabled in base configuration
- [x] Observability enabled with 100% sampling
- [x] Custom domains configured for staging/production

#### Testing
```bash
# Test local dev environment
npm run dev
# Verify: Worker starts with pm-dev name

# Test staging deployment (requires Cloudflare setup)
npm run build
npx wrangler deploy --env staging --dry-run
# Verify: Shows pm-staging worker name

# Test production deployment
npx wrangler deploy --env production --dry-run
# Verify: Shows pm worker name
```

---

### Story 1.2: Set Up Xata Database with Branching

**Priority:** CRITICAL
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As a** developer
**I want** Xata database configured with branch-per-environment strategy
**So that** dev/staging/production have isolated data and PR previews get dedicated branches

#### Technical Requirements

1. **Xata Project Setup**
   - Create new Xata project: `printfarm-manager`
   - Main database instance with Postgres compatibility

2. **Branch Strategy**
   - Three persistent branches: `dev`, `staging`, `production`
   - `dev`: Default branch for local development
   - `staging`: Staging environment (master branch)
   - `production`: Production environment (production branch)
   - PR preview branches: Auto-created/deleted by Cloudflare

3. **Connection Configuration**
   - Environment-specific connection strings as Cloudflare secrets
   - Branch names configurable per environment

4. **Backup Configuration**
   - Verify automatic daily backups in Xata dashboard
   - Retention: 7 days minimum

#### Implementation Details

**Step 1: Create Xata Project**
```bash
# Install Xata CLI
npm install -g @xata.io/cli

# Authenticate
xata auth login

# Initialize project (interactive)
xata init
# Choose: Create new database
# Name: printfarm-manager
# Region: us-east-1 (or appropriate for your location)
```

**Step 2: Create Branches**
```bash
# Create dev branch (if not default)
xata branch create dev

# Create staging branch
xata branch create staging

# Create production branch
xata branch create production
```

**Step 3: Configure Prisma Connection**

**File:** `/prisma/schema.prisma`
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Schema defined in Epic 2, Story 2.1
// This story only sets up infrastructure
```

**Step 4: Set Connection Strings per Environment**

**Local Development (.dev.vars):**
```bash
# .dev.vars (gitignored)
DATABASE_URL=postgresql://[workspace]:[api-key]@[region].xata.sh/printfarm-manager:dev?sslmode=require
```

**Staging (Cloudflare Secret):**
```bash
echo "postgresql://[workspace]:[api-key]@[region].xata.sh/printfarm-manager:staging?sslmode=require" | \
  npx wrangler secret put DATABASE_URL --env staging
```

**Production (Cloudflare Secret):**
```bash
echo "postgresql://[workspace]:[api-key]@[region].xata.sh/printfarm-manager:production?sslmode=require" | \
  npx wrangler secret put DATABASE_URL --env production
```

**Step 5: Update wrangler.jsonc with Xata Binding**

```jsonc
{
  // ... existing config
  "env": {
    "staging": {
      "vars": {
        "XATA_BRANCH": "staging"
      }
    },
    "production": {
      "vars": {
        "XATA_BRANCH": "production"
      }
    }
  }
}
```

#### Acceptance Criteria
- [x] Xata project created with main database
- [x] Three persistent branches exist: dev, staging, production
- [x] Xata CLI authenticated locally
- [x] DATABASE_URL environment variable set per environment
- [x] Connection successful from local dev environment
- [x] Daily backups confirmed in Xata dashboard
- [x] PR preview branch auto-creation configured (verify in Story 1.4)

#### Testing
```bash
# Test dev branch connection
npm run dev
# Access API route that logs database connection success

# Test staging connection (after deployment)
curl https://pm-staging.solsystemlabs.com/api/health
# Verify: Returns database connection status

# Verify branches in Xata dashboard
# Navigate to: https://app.xata.io/workspaces/[workspace]/databases/printfarm-manager
# Confirm: dev, staging, production branches visible
```

---

### Story 1.3: Configure Cloudflare R2 Buckets

**Priority:** CRITICAL
**Complexity:** Low
**Estimated Effort:** 2-3 hours

#### User Story
**As a** developer
**I want** separate R2 buckets for each environment
**So that** uploaded files don't mix between dev/staging/production

#### Technical Requirements

1. **Three R2 Buckets**
   - `pm-dev-files`: Development environment
   - `pm-staging-files`: Staging environment
   - `pm-files`: Production environment

2. **Bucket Configuration**
   - Versioning enabled (for disaster recovery per NFR-12)
   - CORS enabled for application domains
   - Public access: Disabled (use presigned URLs)

3. **Wrangler Bindings**
   - Bind buckets to Workers using `[[r2_buckets]]` syntax
   - Binding name: `FILES_BUCKET`

4. **Storage Limits**
   - Free tier: 10GB storage, 1M class A ops/month, 10M class B ops/month
   - Monitor in Cloudflare Dashboard

#### Implementation Details

**Step 1: Create R2 Buckets**

Using Cloudflare Dashboard:
1. Navigate to R2 → Create bucket
2. Create `pm-dev-files` (development)
3. Create `pm-staging-files` (staging)
4. Create `pm-files` (production)

Or via Wrangler CLI:
```bash
npx wrangler r2 bucket create pm-dev-files
npx wrangler r2 bucket create pm-staging-files
npx wrangler r2 bucket create pm-files
```

**Step 2: Enable Versioning**
```bash
# Versioning must be enabled via Dashboard
# Navigate to: R2 → [bucket] → Settings → Versioning → Enable
```

**Step 3: Configure CORS**

**File:** `/cors-policy.json` (temporary, applied via Dashboard)
```json
{
  "AllowedOrigins": [
    "http://localhost:3000",
    "https://pm-staging.solsystemlabs.com",
    "https://pm.solsystemlabs.com"
  ],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

Apply via Cloudflare Dashboard:
- R2 → [bucket] → Settings → CORS Policy → Add Policy

**Step 4: Update wrangler.jsonc with Bindings**

```jsonc
{
  "name": "pm-dev",
  // ... existing config
  "r2_buckets": [
    {
      "binding": "FILES_BUCKET",
      "bucket_name": "pm-dev-files"
    }
  ],
  "env": {
    "staging": {
      "name": "pm-staging",
      "r2_buckets": [
        {
          "binding": "FILES_BUCKET",
          "bucket_name": "pm-staging-files"
        }
      ]
    },
    "production": {
      "name": "pm",
      "r2_buckets": [
        {
          "binding": "FILES_BUCKET",
          "bucket_name": "pm-files"
        }
      ]
    }
  }
}
```

#### Acceptance Criteria
- [x] Three R2 buckets created with correct names
- [x] Versioning enabled on all buckets
- [x] CORS policy applied to all buckets
- [x] Wrangler bindings configured per environment
- [x] Test upload/download successful in dev environment
- [x] Storage usage visible in Cloudflare Dashboard

#### Testing
**Create Test API Route:** `/src/routes/api/test-r2.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'

export const Route = createFileRoute('/api/test-r2')({
  server: {
    handlers: {
      GET: async () => {
        const cf = getContext('cloudflare')
        const bucket = cf.env.FILES_BUCKET

        // Test write
        const testKey = 'test/test.txt'
        await bucket.put(testKey, 'Hello from R2!', {
          httpMetadata: {
            contentType: 'text/plain',
          },
        })

        // Test read
        const object = await bucket.get(testKey)
        const content = await object?.text()

        // Test delete
        await bucket.delete(testKey)

        return json({
          success: true,
          content,
          message: 'R2 read/write/delete successful',
        })
      },
    },
  },
})
```

**Run Test:**
```bash
npm run dev
curl http://localhost:3000/api/test-r2
# Expected: { success: true, content: "Hello from R2!", message: "..." }
```

---

### Story 1.4: Implement Cloudflare Workers Builds CI/CD

**Priority:** CRITICAL
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As a** developer
**I want** automated deployments via Cloudflare Workers Builds
**So that** pushing to master/production branches automatically deploys to staging/production

#### Technical Requirements

1. **GitHub Repository Connection**
   - Connect printfarm-manager repo to Cloudflare Workers Builds
   - Configure build command: `npm run build`
   - Configure output directory: `dist/server`

2. **Branch-Based Deployments**
   - `master` branch → Deploy to `pm-staging` worker
   - `production` branch → Deploy to `pm` worker
   - PR branches → Generate isolated preview URLs

3. **Environment Variables**
   - Set `CLOUDFLARE_ENV=staging` for master branch builds
   - Set `CLOUDFLARE_ENV=production` for production branch builds
   - Set `DATABASE_URL` secret per environment

4. **Preview URL Strategy**
   - PR previews deploy with `--env staging` config but isolated URLs
   - Format: `<branch-name>-pm-staging.<subdomain>.workers.dev`
   - No impact on live staging environment

5. **Deployment Requirements**
   - Complete in ≤5 minutes (per NFR-10)
   - Failed builds prevent deployment
   - Notifications for failed builds

#### Implementation Details

**Step 1: Connect Repository to Cloudflare**

1. Navigate to Cloudflare Dashboard → Workers & Pages → Create → Connect Git
2. Select GitHub repository: `solsystemlabs/printfarm-manager`
3. Configure project:
   - **Project name:** printfarm-manager
   - **Production branch:** production
   - **Build command:** `npm run build`
   - **Build output directory:** `dist/server`

**Step 2: Configure Branch Deployments**

In Cloudflare Dashboard:
- **Settings → Builds & Deployments → Branch deployments**
  - Production branch: `production` → Deploy to `pm` worker
  - Preview branch: `master` → Deploy to `pm-staging` worker
  - Enable PR previews: ✅

**Step 3: Set Environment Variables**

In Cloudflare Dashboard:
- **Settings → Environment Variables**

**For Production (production branch):**
```
CLOUDFLARE_ENV=production
DATABASE_URL=(set as secret)
```

**For Previews (master + PR branches):**
```
CLOUDFLARE_ENV=staging
DATABASE_URL=(set as secret, staging connection string)
```

**Step 4: Configure Build Settings**

Cloudflare automatically uses `wrangler.jsonc` during deployment. Ensure build generates correct config:

**File:** `/vite.config.ts` (verify exists)
```typescript
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/start/vite'

export default defineConfig({
  plugins: [tanstackStart()],
  build: {
    // TanStack Start generates dist/server/wrangler.json during build
    // CLOUDFLARE_ENV determines which env config is used
  },
})
```

**Step 5: Test Deployment Workflow**

Create test branch:
```bash
git checkout -b test-deployment
echo "# Test deployment" >> README.md
git add README.md
git commit -m "Test: Verify CI/CD pipeline"
git push origin test-deployment
```

Open PR → Verify:
- Cloudflare builds automatically
- Preview URL generated in PR comments
- Deployment completes in ≤5 minutes

**Step 6: Document Deployment Process**

**File:** `/docs/DEPLOYMENT.md`
```markdown
# Deployment Guide

## Environments
- **Development**: Local (`npm run dev`)
- **Staging**: https://pm-staging.solsystemlabs.com (auto-deploy on push to `master`)
- **Production**: https://pm.solsystemlabs.com (auto-deploy on push to `production`)

## Deployment Workflow

### Deploy to Staging
1. Merge PR to `master` branch
2. Cloudflare builds automatically
3. Deployment completes in ~3-5 minutes
4. Verify: https://pm-staging.solsystemlabs.com

### Deploy to Production
1. Ensure staging is stable
2. Merge `master` into `production`:
   ```bash
   git checkout production
   git merge master
   git push
   ```
3. Cloudflare builds automatically
4. Deployment completes in ~3-5 minutes
5. Verify: https://pm.solsystemlabs.com

### PR Previews
- Every PR gets isolated preview URL
- Format: `<branch-name>-pm-staging.<subdomain>.workers.dev`
- No impact on staging environment
- Automatically deleted when PR closed

## Rollback Procedure
1. Navigate to Cloudflare Dashboard → Workers & Pages → printfarm-manager
2. Click "View deployments"
3. Find previous successful deployment
4. Click "Rollback to this deployment"
```

#### Acceptance Criteria
- [x] GitHub repository connected to Cloudflare Workers Builds
- [x] Build command configured: `npm run build`
- [x] Staging deployment configured for `master` branch
- [x] Production deployment configured for `production` branch
- [x] PR preview builds generate isolated preview URLs
- [x] Environment variables set correctly per environment
- [x] Deployment completes in ≤5 minutes
- [x] Failed builds prevent deployment
- [x] Deployment documentation created

#### Testing
```bash
# Test 1: PR Preview
1. Create PR with minor change
2. Wait for Cloudflare build
3. Verify preview URL posted in PR comments
4. Access preview URL, verify ENVIRONMENT=staging
5. Merge PR, verify preview deleted

# Test 2: Staging Deployment
1. Push to master branch
2. Monitor Cloudflare Dashboard for build status
3. Access https://pm-staging.solsystemlabs.com
4. Verify new changes deployed

# Test 3: Production Deployment
1. Merge master → production
2. Monitor Cloudflare Dashboard
3. Access https://pm.solsystemlabs.com
4. Verify new changes deployed

# Test 4: Failed Build Handling
1. Introduce TypeScript error
2. Push to branch, create PR
3. Verify build fails
4. Verify deployment does NOT occur
```

---

### Story 1.5: Implement Logging and Observability

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As a** developer
**I want** comprehensive logging for all API requests and errors
**So that** I can debug issues in staging/production environments

#### Technical Requirements

1. **Structured Logging**
   - JSON format for machine readability
   - Consistent schema across all log entries
   - Fields: timestamp, event, environment, data

2. **Request Logging**
   - Log all API requests: method, path, status, duration
   - Log user agent, IP (if available)
   - No sensitive data (passwords, tokens)

3. **Error Logging**
   - Log all errors with descriptive messages
   - Never log stack traces to user responses (log to console only)
   - Include error codes for client-side handling

4. **Performance Metrics**
   - Log operation durations: uploads, extractions, queries
   - Identify slow operations (>1s per NFR-1)

5. **Log Access**
   - Cloudflare Dashboard → Workers & Pages → [worker] → Logs
   - Real-time tail: `npx wrangler tail --env staging`
   - 24-hour retention on free tier

#### Implementation Details

**Step 1: Create Logger Utility**

**File:** `/src/lib/utils/logger.ts`
```typescript
import { getContext } from 'vinxi/http'

export interface LogEvent {
  timestamp: string
  event: string
  environment: string
  [key: string]: unknown
}

export function log(event: string, data: Record<string, unknown> = {}) {
  const cf = getContext('cloudflare')
  const environment = cf.env.ENVIRONMENT || 'unknown'

  const logEntry: LogEvent = {
    timestamp: new Date().toISOString(),
    event,
    environment,
    ...data,
  }

  console.log(JSON.stringify(logEntry))
}

export function logError(event: string, error: Error, data: Record<string, unknown> = {}) {
  const cf = getContext('cloudflare')
  const environment = cf.env.ENVIRONMENT || 'unknown'

  const logEntry: LogEvent = {
    timestamp: new Date().toISOString(),
    event,
    environment,
    error_message: error.message,
    error_name: error.name,
    // Stack trace logged to console, NOT returned to user
    error_stack: error.stack,
    ...data,
  }

  console.error(JSON.stringify(logEntry))
}

export function logPerformance(event: string, durationMs: number, data: Record<string, unknown> = {}) {
  log(`${event}_performance`, {
    duration_ms: durationMs,
    ...data,
  })
}
```

**Step 2: Create Request Logging Middleware**

**File:** `/src/lib/utils/request-logger.ts`
```typescript
import { log } from './logger'

export async function logRequest(
  request: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const startTime = Date.now()
  const url = new URL(request.url)

  log('request_start', {
    method: request.method,
    path: url.pathname,
    query: url.search,
  })

  try {
    const response = await handler()
    const duration = Date.now() - startTime

    log('request_complete', {
      method: request.method,
      path: url.pathname,
      status: response.status,
      duration_ms: duration,
    })

    return response
  } catch (error) {
    const duration = Date.now() - startTime

    log('request_error', {
      method: request.method,
      path: url.pathname,
      duration_ms: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    throw error
  }
}
```

**Step 3: Apply Logging to Example API Route**

**File:** `/src/routes/api/health.ts`
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'
import { log } from '~/lib/utils/logger'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cf = getContext('cloudflare')
        const environment = cf.env.ENVIRONMENT

        log('health_check', {
          environment,
          timestamp: new Date().toISOString(),
        })

        return json({
          status: 'ok',
          environment,
          timestamp: new Date().toISOString(),
        })
      },
    },
  },
})
```

**Step 4: Create Error Response Utility**

**File:** `/src/lib/utils/errors.ts`
```typescript
import { json } from '@tanstack/react-start'
import { logError } from './logger'

export interface ApiError {
  code: string
  message: string
  field?: string
  details?: unknown
}

export function createErrorResponse(
  error: Error,
  statusCode: number,
  errorCode: string,
  field?: string
): Response {
  // Log error with full details
  logError('api_error', error, {
    status_code: statusCode,
    error_code: errorCode,
    field,
  })

  // Return sanitized error to client (no stack trace)
  const errorResponse: { error: ApiError } = {
    error: {
      code: errorCode,
      message: error.message,
      field,
    },
  }

  return json(errorResponse, { status: statusCode })
}
```

**Step 5: Document Logging Standards**

**File:** `/docs/LOGGING.md`
```markdown
# Logging Standards

## Log Format
All logs use JSON format:
```json
{
  "timestamp": "2025-10-15T12:34:56.789Z",
  "event": "request_complete",
  "environment": "staging",
  "method": "POST",
  "path": "/api/models/upload",
  "status": 201,
  "duration_ms": 1234
}
```

## Event Types
- `request_start` - API request initiated
- `request_complete` - API request succeeded
- `request_error` - API request failed
- `[operation]_performance` - Performance metric
- `health_check` - Health check endpoint accessed
- `api_error` - Application error occurred

## Accessing Logs

### Real-Time Tailing
```bash
# Staging
npx wrangler tail --env staging

# Production
npx wrangler tail --env production
```

### Cloudflare Dashboard
1. Navigate to Workers & Pages
2. Select printfarm-manager
3. Click "Logs" tab
4. Filter by environment, status, time range

### Log Retention
- Free tier: 24 hours
- Paid tier: 7 days (if upgraded)
```

#### Acceptance Criteria
- [x] Logger utility created with structured JSON format
- [x] Request logging captures method, path, status, duration
- [x] Error logging captures error details without exposing stack traces to users
- [x] Performance logging utility created
- [x] Health check endpoint implemented with logging
- [x] Logs accessible in Cloudflare Dashboard for all environments
- [x] Real-time log tailing working with `wrangler tail`
- [x] Logging documentation created

#### Testing
```bash
# Test 1: Health Check Logging
npm run dev
curl http://localhost:3000/api/health

# Check console output:
# Expected: {"timestamp":"...","event":"health_check","environment":"development"}

# Test 2: Real-Time Tailing (staging)
# Terminal 1: npx wrangler tail --env staging
# Terminal 2: curl https://pm-staging.solsystemlabs.com/api/health
# Verify: Log appears in Terminal 1

# Test 3: Error Logging
# Create API route that throws error
curl http://localhost:3000/api/error-test
# Verify: Error logged to console with stack trace
# Verify: Response to user does NOT include stack trace

# Test 4: Performance Logging
# Upload large file (Epic 2+)
# Verify: duration_ms logged for upload operation
```

---

### Story 1.6: Create Environment Indicator UI Component

**Priority:** MEDIUM
**Complexity:** Low
**Estimated Effort:** 2-3 hours

#### User Story
**As a** user
**I want** to see which environment I'm using (dev/staging/production)
**So that** I don't accidentally test in production or confuse environments

#### Technical Requirements

1. **Footer Component**
   - Always visible at bottom of page
   - Non-intrusive (small, fixed position)
   - Shows environment name

2. **Visual Differentiation**
   - Development: Gray background
   - Staging: Yellow/amber background
   - Production: Green background

3. **Environment Detection**
   - Fetch from API endpoint that reads Cloudflare context
   - Client-side caching (no need to refetch per page)

4. **Additional Info (Optional)**
   - Click to expand: worker name, deployment time
   - Copy environment info button

5. **Responsive Design**
   - Mobile: Remains visible but smaller
   - Desktop: Fixed bottom-right corner

#### Implementation Details

**Step 1: Create Environment API Endpoint**

**File:** `/src/routes/api/environment.ts`
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'

export const Route = createFileRoute('/api/environment')({
  server: {
    handlers: {
      GET: async () => {
        const cf = getContext('cloudflare')
        const environment = cf.env.ENVIRONMENT || 'unknown'

        return json({
          environment,
          workerName: cf.env.name || 'unknown',
          timestamp: new Date().toISOString(),
        })
      },
    },
  },
})
```

**Step 2: Create Environment Indicator Component**

**File:** `/src/components/shared/EnvironmentIndicator.tsx`
```typescript
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

interface EnvironmentInfo {
  environment: string
  workerName: string
  timestamp: string
}

export function EnvironmentIndicator() {
  const [expanded, setExpanded] = useState(false)

  const { data } = useQuery<EnvironmentInfo>({
    queryKey: ['environment'],
    queryFn: () => fetch('/api/environment').then((r) => r.json()),
    staleTime: Infinity, // Never refetch (doesn't change during session)
  })

  if (!data) return null

  const colors = {
    development: 'bg-gray-600 text-white',
    staging: 'bg-yellow-500 text-black',
    production: 'bg-green-600 text-white',
    unknown: 'bg-red-600 text-white',
  }

  const bgColor = colors[data.environment as keyof typeof colors] || colors.unknown

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium shadow-lg transition-all hover:shadow-xl ${bgColor}`}
        aria-label={`Environment: ${data.environment}`}
      >
        {data.environment.toUpperCase()}
      </button>

      {expanded && (
        <div
          className={`absolute bottom-full right-0 mb-2 rounded-lg p-3 shadow-xl ${bgColor}`}
        >
          <div className="text-xs space-y-1">
            <div>
              <strong>Worker:</strong> {data.workerName}
            </div>
            <div>
              <strong>Deployed:</strong>{' '}
              {new Date(data.timestamp).toLocaleString()}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `Environment: ${data.environment}\nWorker: ${data.workerName}`
                )
              }}
              className="mt-2 w-full rounded bg-white bg-opacity-20 px-2 py-1 text-xs hover:bg-opacity-30"
            >
              Copy Info
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Add to Root Layout**

**File:** `/src/routes/__root.tsx`
```typescript
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { EnvironmentIndicator } from '~/components/shared/EnvironmentIndicator'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <div className="min-h-screen">
        <Outlet />
      </div>
      <EnvironmentIndicator />
    </>
  )
}
```

#### Acceptance Criteria
- [x] Environment API endpoint returns environment info
- [x] EnvironmentIndicator component created
- [x] Component displays environment name in footer
- [x] Visual colors: development (gray), staging (yellow), production (green)
- [x] Click to expand shows worker name and timestamp
- [x] Copy info button works
- [x] Component added to root layout (visible on all pages)
- [x] Mobile-responsive (remains visible, non-intrusive)

#### Testing
```bash
# Test 1: Development Environment
npm run dev
# Visit: http://localhost:3000
# Verify: Gray badge "DEVELOPMENT" in bottom-right corner
# Click badge → Verify: Shows worker name "pm-dev"

# Test 2: Staging Environment
# Deploy to staging
# Visit: https://pm-staging.solsystemlabs.com
# Verify: Yellow badge "STAGING" in bottom-right corner

# Test 3: Production Environment
# Deploy to production
# Visit: https://pm.solsystemlabs.com
# Verify: Green badge "PRODUCTION" in bottom-right corner

# Test 4: Copy Functionality
# Click badge → Click "Copy Info"
# Paste into text editor
# Verify: Contains environment and worker name

# Test 5: Mobile Responsiveness
# Open dev tools → Toggle device toolbar → iPhone view
# Verify: Badge still visible, appropriately sized
```

---

### Story 1.7: Implement Storage Usage Visibility Dashboard

**Priority:** MEDIUM
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner
**I want** to see total R2 storage consumed and file counts
**So that** I can monitor usage against free tier limits and plan for overages

#### Technical Requirements

1. **Dashboard Page**
   - URL: `/admin/storage`
   - No authentication in MVP (dedicated URL is sufficient)
   - Desktop-optimized layout

2. **Storage Metrics**
   - Total bytes stored across all file types
   - File counts by type: models, slices, images
   - Percentage of 10GB free tier limit
   - Visual progress bar

3. **Calculation Method**
   - Query database for all file records
   - Sum file_size fields
   - Cache results (expensive to recalculate)
   - Manual refresh button

4. **File Type Breakdown**
   - Models: .stl, .3mf
   - Slices: .gcode.3mf, .gcode
   - Images: .png, .jpg, .jpeg

5. **External Links**
   - Link to Cloudflare Dashboard for detailed analytics

#### Implementation Details

**Step 1: Create Storage Calculation Utility**

**File:** `/src/lib/storage/usage.ts`
```typescript
import { PrismaClient } from '@prisma/client'

export interface StorageUsage {
  totalBytes: number
  totalFiles: number
  breakdown: {
    models: { count: number; bytes: number }
    slices: { count: number; bytes: number }
    images: { count: number; bytes: number }
  }
  percentOfLimit: number
  lastCalculated: Date
}

const FREE_TIER_LIMIT_BYTES = 10 * 1024 * 1024 * 1024 // 10GB

export async function calculateStorageUsage(
  prisma: PrismaClient
): Promise<StorageUsage> {
  // Note: This requires database schema from Epic 2
  // For now, this is the structure. Implement after Story 2.1

  // Query models
  const models = await prisma.model.findMany({
    select: { fileSize: true, contentType: true },
  })

  const modelsTotal = models.reduce((sum, m) => sum + m.fileSize, 0)
  const modelsCount = models.length

  // Query slices
  const slices = await prisma.slice.findMany({
    select: { fileSize: true, contentType: true },
  })

  const slicesTotal = slices.reduce((sum, s) => sum + s.fileSize, 0)
  const slicesCount = slices.length

  // Images calculated from thumbnail_url counts
  // (Epic 2+ will track actual image files separately if needed)
  const imagesCount = 0
  const imagesTotal = 0

  const totalBytes = modelsTotal + slicesTotal + imagesTotal
  const totalFiles = modelsCount + slicesCount + imagesCount
  const percentOfLimit = (totalBytes / FREE_TIER_LIMIT_BYTES) * 100

  return {
    totalBytes,
    totalFiles,
    breakdown: {
      models: { count: modelsCount, bytes: modelsTotal },
      slices: { count: slicesCount, bytes: slicesTotal },
      images: { count: imagesCount, bytes: imagesTotal },
    },
    percentOfLimit,
    lastCalculated: new Date(),
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
```

**Step 2: Create Storage API Endpoint**

**File:** `/src/routes/api/admin/storage.ts`
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { PrismaClient } from '@prisma/client'
import { calculateStorageUsage } from '~/lib/storage/usage'
import { log } from '~/lib/utils/logger'

const prisma = new PrismaClient()

export const Route = createFileRoute('/api/admin/storage')({
  server: {
    handlers: {
      GET: async () => {
        log('storage_calculation_start')

        const startTime = Date.now()
        const usage = await calculateStorageUsage(prisma)
        const duration = Date.now() - startTime

        log('storage_calculation_complete', {
          duration_ms: duration,
          total_bytes: usage.totalBytes,
          total_files: usage.totalFiles,
        })

        return json(usage)
      },
    },
  },
})
```

**Step 3: Create Storage Dashboard Page**

**File:** `/src/routes/admin/storage.tsx`
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { formatBytes, type StorageUsage } from '~/lib/storage/usage'

export const Route = createFileRoute('/admin/storage')({
  component: StorageDashboard,
})

function StorageDashboard() {
  const { data, isLoading, refetch } = useQuery<StorageUsage>({
    queryKey: ['storage-usage'],
    queryFn: () => fetch('/api/admin/storage').then((r) => r.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes (expensive query)
  })

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Storage Usage</h1>
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const warningThreshold = 80 // 80% of limit
  const isNearLimit = data.percentOfLimit >= warningThreshold

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Storage Usage</h1>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Total Usage Card */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Total Storage</h2>
        <div className="text-4xl font-bold mb-2">
          {formatBytes(data.totalBytes)}
        </div>
        <div className="text-gray-600 mb-4">
          {data.totalFiles.toLocaleString()} total files
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-8 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isNearLimit ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(data.percentOfLimit, 100)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-sm font-medium">
            {data.percentOfLimit.toFixed(1)}% of 10GB free tier
          </div>
        </div>

        {isNearLimit && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 text-sm">
              Warning: Approaching free tier limit. Consider upgrading or
              deleting unused files.
            </p>
          </div>
        )}
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StorageCard
          title="Models"
          count={data.breakdown.models.count}
          bytes={data.breakdown.models.bytes}
        />
        <StorageCard
          title="Slices"
          count={data.breakdown.slices.count}
          bytes={data.breakdown.slices.bytes}
        />
        <StorageCard
          title="Images"
          count={data.breakdown.images.count}
          bytes={data.breakdown.images.bytes}
        />
      </div>

      {/* External Links */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Need More Details?</h3>
        <p className="text-sm text-gray-700 mb-3">
          View detailed storage analytics in the Cloudflare Dashboard.
        </p>
        <a
          href="https://dash.cloudflare.com/r2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Open Cloudflare Dashboard →
        </a>
      </div>

      {/* Last Calculated */}
      <div className="mt-6 text-sm text-gray-600">
        Last calculated: {new Date(data.lastCalculated).toLocaleString()}
      </div>
    </div>
  )
}

function StorageCard({
  title,
  count,
  bytes,
}: {
  title: string
  count: number
  bytes: number
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="text-2xl font-bold mb-1">{formatBytes(bytes)}</div>
      <div className="text-sm text-gray-600">
        {count.toLocaleString()} {count === 1 ? 'file' : 'files'}
      </div>
    </div>
  )
}
```

#### Acceptance Criteria
- [x] `/admin/storage` page accessible
- [x] Dashboard displays total bytes and file counts
- [x] File counts broken down by type (models, slices, images)
- [x] Storage displayed in human-readable format (GB/MB)
- [x] Progress bar shows percentage of 10GB limit
- [x] Warning shown when >80% of limit
- [x] Refresh button recalculates on demand
- [x] Link to Cloudflare Dashboard provided
- [x] Last calculated timestamp displayed

#### Testing
```bash
# Note: This story requires database schema from Epic 2
# Testing deferred until after Story 2.1 (schema implemented)

# Test 1: Empty Database
# Visit: http://localhost:3000/admin/storage
# Expected: 0 Bytes, 0 files

# Test 2: After Uploading Files (Epic 2+)
# Upload several model/slice files
# Visit: /admin/storage
# Verify: Correct totals, breakdown accurate

# Test 3: Refresh Button
# Click "Refresh"
# Verify: Loading state shown, data reloaded

# Test 4: Warning Threshold
# Manually adjust limit constant for testing
# Verify: Red progress bar and warning shown at >80%

# Test 5: External Link
# Click "Open Cloudflare Dashboard"
# Verify: Opens to R2 page in Cloudflare
```

---

## Implementation Sequence

### Phase 1: Core Infrastructure (Stories 1.1-1.3)
**Duration:** 1-2 days
**Parallel Work:** Stories 1.1, 1.2, 1.3 can be done simultaneously

1. Story 1.1: Configure wrangler.jsonc (2-4 hours)
2. Story 1.2: Set up Xata database (4-6 hours)
3. Story 1.3: Configure R2 buckets (2-3 hours)

**Milestone:** Three environments configured, local dev working

### Phase 2: CI/CD and Observability (Stories 1.4-1.5)
**Duration:** 1-2 days
**Sequential:** Story 1.4 must complete before 1.5

4. Story 1.4: Implement CI/CD (4-6 hours)
5. Story 1.5: Implement logging (4-6 hours)

**Milestone:** Automated deployments working, comprehensive logging operational

### Phase 3: UI Components (Stories 1.6-1.7)
**Duration:** 1 day
**Parallel Work:** Stories 1.6 and 1.7 can be done simultaneously

6. Story 1.6: Environment indicator (2-3 hours)
7. Story 1.7: Storage dashboard (4-6 hours, deferred implementation until Epic 2)

**Milestone:** Epic 1 complete, ready for Epic 2

---

## Technical Approach

### Cloudflare Workers Environment Strategy

**Single Configuration, Multiple Environments:**
- Use `wrangler.jsonc` with base config + `env` blocks
- Base config = local development (`pm-dev`)
- `env.staging` = staging configuration
- `env.production` = production configuration

**Why This Approach:**
- Single source of truth for configuration
- Minimal duplication
- Clear environment isolation
- Aligns with Cloudflare best practices

### Database Branching Strategy

**Branch-Per-Environment:**
- Each environment gets persistent Xata branch
- `dev`: Local development (frequently reset)
- `staging`: Staging environment (semi-stable data)
- `production`: Production environment (live data)

**PR Preview Branches:**
- Auto-created by Cloudflare when PR opened
- Named: `preview-<pr-number>`
- Auto-deleted when PR closed/merged
- Inherits from staging branch

**Why This Approach:**
- Complete data isolation prevents cross-contamination
- PR previews enable safe testing of schema changes
- Staging data persists for regression testing
- Production data never touched during development

### R2 Storage Strategy

**Bucket-Per-Environment:**
- Each environment gets dedicated R2 bucket
- Prevents file mixing between environments
- Staging files never interfere with production

**Versioning Enabled:**
- Provides disaster recovery (can restore deleted files)
- Minimal cost impact on free tier
- Satisfies NFR-12 backup requirements

### Logging Strategy

**Structured JSON Logging:**
- All logs use consistent JSON schema
- Machine-readable for future analysis
- Human-readable when pretty-printed

**Key Principles:**
1. **Never log sensitive data** (passwords, tokens, PII)
2. **Never expose stack traces to users** (log to console only)
3. **Always include context** (environment, timestamp, event type)
4. **Log performance metrics** (identify slow operations)
5. **Use event-based naming** (e.g., `request_complete`, not just "request")

### Environment Indicator Strategy

**Client-Side Component with API:**
- API endpoint reads Cloudflare context (server-side)
- Client fetches once, caches indefinitely
- No performance impact (single fetch per session)

**Visual Safety:**
- Color-coded by environment (yellow staging, green production)
- Always visible (fixed position footer)
- Prevents accidental production operations

---

## Acceptance Criteria

### Epic-Level Success Criteria

Epic 1 is considered complete when:

1. **Three Environments Operational**
   - [ ] Local dev runs with `npm run dev` using pm-dev worker
   - [ ] Staging accessible at pm-staging.solsystemlabs.com
   - [ ] Production accessible at pm.solsystemlabs.com
   - [ ] Each environment uses isolated Xata branch
   - [ ] Each environment uses isolated R2 bucket

2. **Automated Deployments Working**
   - [ ] Push to `master` auto-deploys to staging
   - [ ] Push to `production` auto-deploys to production
   - [ ] PR creation generates isolated preview URL
   - [ ] Deployment completes in ≤5 minutes
   - [ ] Failed builds prevent deployment

3. **Logging Operational**
   - [ ] All API requests logged with method/path/status/duration
   - [ ] Errors logged with descriptive messages (no stack traces to users)
   - [ ] Logs accessible in Cloudflare Dashboard for all environments
   - [ ] Real-time tailing works with `wrangler tail`

4. **UI Components Functional**
   - [ ] Environment indicator visible on all pages
   - [ ] Indicator shows correct environment per deployment
   - [ ] Storage dashboard accessible at `/admin/storage` (implementation deferred to Epic 2)

5. **Documentation Complete**
   - [ ] wrangler.jsonc documented with comments
   - [ ] DEPLOYMENT.md created with workflow instructions
   - [ ] LOGGING.md created with standards and access methods
   - [ ] Environment variables documented in .env.example

---

## Testing Strategy

### Unit Tests

**Not Applicable for Epic 1** - This epic is primarily infrastructure configuration with minimal application code. Testing occurs through manual verification and integration testing.

### Integration Tests

**Environment Configuration Tests:**
```bash
# Test 1: Local Development
npm run dev
curl http://localhost:3000/api/health
# Expected: { status: "ok", environment: "development" }

# Test 2: Staging Deployment
# Push to master → Wait for deployment
curl https://pm-staging.solsystemlabs.com/api/health
# Expected: { status: "ok", environment: "staging" }

# Test 3: Production Deployment
# Push to production → Wait for deployment
curl https://pm.solsystemlabs.com/api/health
# Expected: { status: "ok", environment: "production" }

# Test 4: PR Preview
# Create PR → Wait for preview URL
curl https://<branch-name>-pm-staging.<subdomain>.workers.dev/api/health
# Expected: { status: "ok", environment: "staging" }
```

**Database Connection Tests:**
```bash
# Test in each environment
# Create API route that queries database (even empty query)
# Verify successful connection without errors
```

**R2 Storage Tests:**
```bash
# Test R2 read/write/delete in each environment using test-r2 endpoint
# Verify no cross-contamination between environments
```

**Logging Tests:**
```bash
# Test 1: Request Logging
curl http://localhost:3000/api/health
# Check console: Verify structured JSON log appears

# Test 2: Error Logging
curl http://localhost:3000/api/nonexistent
# Check console: Verify error logged with details

# Test 3: Real-Time Tailing
# Terminal 1: npx wrangler tail --env staging
# Terminal 2: curl https://pm-staging.solsystemlabs.com/api/health
# Verify: Log appears in Terminal 1 within 1 second
```

### Smoke Tests (Post-Deployment)

Run after each deployment to verify environment health:

```bash
#!/bin/bash
# smoke-test.sh

ENVIRONMENT=$1  # dev, staging, or production
BASE_URL=$2     # http://localhost:3000, https://pm-staging..., etc.

echo "Running smoke tests for $ENVIRONMENT environment..."

# Test 1: Health Check
response=$(curl -s "$BASE_URL/api/health")
echo "Health Check: $response"

# Test 2: Environment API
response=$(curl -s "$BASE_URL/api/environment")
echo "Environment API: $response"

# Test 3: R2 Test (dev/staging only)
if [ "$ENVIRONMENT" != "production" ]; then
  response=$(curl -s "$BASE_URL/api/test-r2")
  echo "R2 Test: $response"
fi

echo "Smoke tests complete!"
```

**Usage:**
```bash
# Local
./smoke-test.sh dev http://localhost:3000

# Staging
./smoke-test.sh staging https://pm-staging.solsystemlabs.com

# Production
./smoke-test.sh production https://pm.solsystemlabs.com
```

---

## Risks and Mitigations

### Risk 1: Cloudflare Workers Builds Configuration Complexity

**Risk Level:** Medium
**Probability:** Medium
**Impact:** High (blocks all deployments)

**Description:**
Cloudflare Workers Builds requires specific configuration for TanStack Start projects. Incorrect `CLOUDFLARE_ENV` setup can cause builds to use wrong environment configuration.

**Mitigation:**
1. Follow existing CLAUDE.md documentation precisely
2. Test with PR preview first (lowest risk)
3. Verify `dist/server/wrangler.json` generated during build
4. Keep staging/production deployment separate (can rollback independently)

**Contingency Plan:**
- If Workers Builds fails, temporarily use manual `wrangler deploy` from local machine
- Debug build logs in Cloudflare Dashboard
- Reach out to Cloudflare support if stuck

---

### Risk 2: Xata Branch Management Complexity

**Risk Level:** Low
**Probability:** Low
**Impact:** Medium (data isolation issues)

**Description:**
PR preview branches auto-created by Cloudflare may not sync properly with Xata branching, causing database connection errors.

**Mitigation:**
1. Verify Xata auto-branching in documentation
2. Test PR preview workflow early
3. Monitor Xata Dashboard during first PR preview deployment
4. Set conservative connection timeouts

**Contingency Plan:**
- If auto-branching fails, manually create preview branches
- Worst case: All PR previews share staging branch (acceptable for MVP)

---

### Risk 3: R2 CORS Configuration Issues

**Risk Level:** Low
**Probability:** Medium
**Impact:** Low (file uploads fail, easily fixable)

**Description:**
Incorrect CORS configuration prevents client-side file uploads or downloads.

**Mitigation:**
1. Apply CORS policy immediately after bucket creation
2. Test with simple upload/download before Epic 2
3. Use broad CORS policy in dev/staging, strict in production

**Contingency Plan:**
- CORS configurable via Cloudflare Dashboard (no deployment needed)
- Can fix in <5 minutes if discovered

---

### Risk 4: Log Retention Limitations

**Risk Level:** Low
**Probability:** Certain (free tier = 24 hours)
**Impact:** Low (debugging window limited)

**Description:**
Cloudflare free tier retains logs for only 24 hours, limiting historical debugging.

**Mitigation:**
1. Use real-time tailing during active development
2. Document important errors immediately
3. Consider upgrading to paid tier if needed ($5/month for 7-day retention)

**Contingency Plan:**
- If critical error occurs and logs expire, reproduce issue locally
- Implement additional application-level logging if needed (e.g., external service)

---

### Risk 5: Storage Dashboard Performance

**Risk Level:** Low
**Probability:** Medium (at scale)
**Impact:** Low (dashboard slow but functional)

**Description:**
Calculating storage usage by querying all database records becomes slow at 1000+ files.

**Mitigation:**
1. Implement caching (5-minute stale time)
2. Add loading states
3. Consider background calculation with cached results (future optimization)

**Contingency Plan:**
- If too slow, calculate storage daily via cron job (Cloudflare Workers Cron)
- Cache results in database table

---

## Code Examples

### Example 1: Accessing Cloudflare Context in API Route

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

        // Environment variable
        const environment = cf.env.ENVIRONMENT

        // R2 bucket binding
        const bucket = cf.env.FILES_BUCKET

        // Database URL (from secret)
        const dbUrl = cf.env.DATABASE_URL

        return json({
          environment,
          message: 'Cloudflare context accessed successfully',
        })
      },
    },
  },
})
```

### Example 2: R2 Upload with Proper Headers

```typescript
async function uploadToR2(bucket: R2Bucket, file: File) {
  const key = `models/${crypto.randomUUID()}.stl`

  await bucket.put(key, file, {
    httpMetadata: {
      contentType: file.type,
      contentDisposition: `attachment; filename="${file.name}"`,
    },
  })

  return {
    key,
    url: `https://your-bucket-url/${key}`,
  }
}
```

### Example 3: Structured Logging Pattern

```typescript
import { log, logError } from '~/lib/utils/logger'

async function uploadFile(file: File) {
  const startTime = Date.now()

  log('file_upload_start', {
    filename: file.name,
    size: file.size,
    type: file.type,
  })

  try {
    // Upload logic...
    const result = await uploadToR2(bucket, file)

    const duration = Date.now() - startTime
    log('file_upload_success', {
      filename: file.name,
      duration_ms: duration,
      r2_key: result.key,
    })

    return result
  } catch (error) {
    logError('file_upload_failed', error as Error, {
      filename: file.name,
      duration_ms: Date.now() - startTime,
    })
    throw error
  }
}
```

### Example 4: Environment-Specific Behavior

```typescript
import { getContext } from 'vinxi/http'

export function isProduction(): boolean {
  const cf = getContext('cloudflare')
  return cf.env.ENVIRONMENT === 'production'
}

// Usage:
if (isProduction()) {
  // Strict validation in production
  validateWithExtraChecks()
} else {
  // Relaxed validation in dev/staging
  validateBasic()
}
```

---

## Dependencies

### External Services Required

1. **Cloudflare Account**
   - Workers subscription (free tier sufficient for MVP)
   - R2 storage enabled
   - Custom domain configured (solsystemlabs.com)

2. **Xata Account**
   - Free tier sufficient for MVP
   - Database created: `printfarm-manager`

3. **GitHub Repository**
   - Connected to Cloudflare Workers Builds
   - Branch protection rules recommended for production

### Internal Dependencies

**Blocks:**
- Epic 2 (requires database schema and R2 buckets operational)
- Epic 3 (requires file upload infrastructure from Epic 2)
- Epic 4 (requires all data models from Epic 2-3)
- Epic 5 (requires indexed data from Epic 4)

**Blocked By:**
- None (this is the foundation)

---

## Deliverables Checklist

### Configuration Files
- [ ] `wrangler.jsonc` created with three environments
- [ ] `.env.example` created with DATABASE_URL template
- [ ] `.dev.vars` created locally (gitignored)
- [ ] `prisma/schema.prisma` initialized (schema definition in Epic 2)

### Documentation
- [ ] `/docs/DEPLOYMENT.md` - Deployment workflows
- [ ] `/docs/LOGGING.md` - Logging standards and access
- [ ] `/docs/CLOUDFLARE_SETUP.md` - Initial setup guide (if not exists)
- [ ] `README.md` updated with environment setup instructions

### Code
- [ ] `/src/lib/utils/logger.ts` - Logging utility
- [ ] `/src/lib/utils/errors.ts` - Error response utility
- [ ] `/src/routes/api/health.ts` - Health check endpoint
- [ ] `/src/routes/api/environment.ts` - Environment info endpoint
- [ ] `/src/routes/api/test-r2.ts` - R2 test endpoint
- [ ] `/src/components/shared/EnvironmentIndicator.tsx` - Environment badge
- [ ] `/src/routes/admin/storage.tsx` - Storage dashboard (defer implementation)
- [ ] `/src/lib/storage/usage.ts` - Storage calculation utility (defer implementation)

### Tests
- [ ] Smoke test script: `/scripts/smoke-test.sh`
- [ ] Manual test documentation in this spec

### Deployments
- [ ] Development environment operational (local)
- [ ] Staging environment operational (pm-staging.solsystemlabs.com)
- [ ] Production environment operational (pm.solsystemlabs.com)
- [ ] PR preview verified working

---

## Definition of Done

Epic 1 is **DONE** when:

1. ✅ All 7 stories completed (1.1-1.7)
2. ✅ All acceptance criteria met per story
3. ✅ Three environments deployed and accessible
4. ✅ Smoke tests passing in all environments
5. ✅ Documentation complete and reviewed
6. ✅ Code merged to master branch
7. ✅ Staging deployment verified working
8. ✅ Team trained on deployment workflow
9. ✅ Epic 2 unblocked and ready to begin

**Sign-Off Required From:**
- Developer (implementation complete)
- Tech Lead (architecture approved)
- Product Owner (business value delivered)

---

## Appendix

### Useful Commands Reference

```bash
# Local Development
npm run dev                          # Start dev server
npm run build                        # Build for deployment

# Cloudflare Workers
npx wrangler deploy                  # Deploy to default (dev)
npx wrangler deploy --env staging    # Deploy to staging
npx wrangler deploy --env production # Deploy to production
npx wrangler tail --env staging      # Real-time logs (staging)

# Xata Database
xata branch list                     # List all branches
xata branch create <name>            # Create new branch
xata branch delete <name>            # Delete branch

# R2 Storage
npx wrangler r2 bucket list          # List all buckets
npx wrangler r2 object list <bucket> # List objects in bucket

# Secrets Management
npx wrangler secret put DATABASE_URL --env staging
npx wrangler secret list --env staging
```

### Environment Variables Reference

| Variable | Description | Set Where |
|----------|-------------|-----------|
| `ENVIRONMENT` | Current environment name | wrangler.jsonc vars |
| `DATABASE_URL` | Xata connection string | Cloudflare secret |
| `CLOUDFLARE_ENV` | Build-time environment | Cloudflare Dashboard |
| `XATA_BRANCH` | Xata branch name | wrangler.jsonc vars |

### Cloudflare Dashboard Navigation

**Workers & Pages:**
- View deployments: Workers & Pages → printfarm-manager
- View logs: Workers & Pages → printfarm-manager → Logs
- Environment variables: Workers & Pages → printfarm-manager → Settings → Variables

**R2 Storage:**
- Bucket management: R2 → Buckets
- Usage metrics: R2 → Overview
- CORS configuration: R2 → [bucket] → Settings → CORS

---

**Document Status:** FINAL
**Ready for Implementation:** YES
**Next Action:** Begin Story 1.1 (Configure Cloudflare Workers Environments)

---

## Post-Review Follow-ups

### Story 1.1 - Configure Cloudflare Workers Environments (Reviewed: 2025-10-16)

**Outcome:** Approved ✅

All acceptance criteria met. Infrastructure configuration properly implemented and manually verified per tech spec guidance.

**Incidental Finding (Unrelated):**
- Fix hydration warning in route test - `src/__tests__/routes/index.test.tsx:18` HTML structure issue (pre-existing, not introduced by Story 1.1)

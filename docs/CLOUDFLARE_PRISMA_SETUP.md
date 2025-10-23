# Prisma Setup for Cloudflare Workers

This guide explains how to properly configure Prisma ORM for deployment on Cloudflare Workers. **These settings are critical** - without them, your application will fail with 500 errors in production.

---

## Table of Contents

1. [Why Cloudflare Workers Need Special Configuration](#why-cloudflare-workers-need-special-configuration)
2. [Required Generator Configuration](#required-generator-configuration)
3. [Common Deployment Issues](#common-deployment-issues)
4. [Connection Pooling with Prisma Accelerate](#connection-pooling-with-prisma-accelerate)
5. [Local Development vs. Production](#local-development-vs-production)
6. [Troubleshooting](#troubleshooting)

---

## Why Cloudflare Workers Need Special Configuration

### The V8 Isolate Problem

Cloudflare Workers run in **V8 isolates**, not traditional Node.js processes. This fundamental difference affects how Prisma operates:

| Environment | Runtime | Process Model | Binary Support |
|------------|---------|---------------|----------------|
| **Node.js** | V8 + Node APIs | Full OS process | ✅ Yes |
| **Cloudflare Workers** | V8 only (workerd) | Lightweight isolate | ❌ No |

### Why the Default Prisma Setup Fails

By default, Prisma uses a **binary query engine** - a compiled executable that runs alongside your Node.js application. This works great in Node.js but **cannot run in Cloudflare Workers** because:

1. **No File System Access**: Workers don't have access to a traditional file system to load the binary
2. **No Native Binaries**: V8 isolates cannot execute native compiled code
3. **Different Runtime**: Workers use `workerd` (Cloudflare's V8 runtime), not Node.js

### The Solution: Client Engine with WASM

Prisma supports a **client engine** mode that uses WebAssembly (WASM) instead of native binaries. WASM can run in V8 isolates, making it compatible with Cloudflare Workers.

---

## Required Generator Configuration

### ✅ Correct Configuration (Cloudflare Workers)

```prisma
// prisma/schema.prisma
generator client {
  provider   = "prisma-client"   // Modern syntax (replaces deprecated prisma-client-js)
  output     = "./generated"      // Where to generate the Prisma Client
  engineType = "client"           // Use client engine (WASM-based, not binary)
  runtime    = "workerd"          // Target Cloudflare's workerd runtime
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### ❌ Incorrect Configuration (Will Fail in Production)

```prisma
// This works in Node.js but FAILS in Cloudflare Workers
generator client {
  provider = "prisma-client-js"  // Old syntax
  // Missing: output, engineType, runtime
}
```

### Configuration Breakdown

| Setting | Value | Purpose | Required? |
|---------|-------|---------|-----------|
| `provider` | `"prisma-client"` | Modern Prisma Client generator | ✅ Yes |
| `output` | `"./generated"` | Custom output directory (avoids conflicts) | ⚠️ Recommended |
| `engineType` | `"client"` | Use WASM-based client engine (not binary) | ✅ **CRITICAL** |
| `runtime` | `"workerd"` | Target Cloudflare's workerd V8 runtime | ✅ **CRITICAL** |

---

## Common Deployment Issues

### Issue 1: Missing `runtime = "workerd"`

**Symptom:**
- Deployment succeeds but app crashes with 500 errors
- Error logs show: `Cannot find module` or `Invalid engine type`

**Cause:**
Prisma generates code targeting Node.js APIs that don't exist in `workerd`

**Fix:**
Add `runtime = "workerd"` to your generator configuration

### Issue 2: Missing `engineType = "client"`

**Symptom:**
- Build succeeds locally but fails in production
- Error: `Cannot spawn query engine binary`

**Cause:**
Prisma tries to use a native binary query engine (not supported in Workers)

**Fix:**
Add `engineType = "client"` to use WASM-based client engine

### Issue 3: Large Bundle Size

**Symptom:**
- Deployment fails with "Worker script too large" error
- Bundle exceeds Cloudflare's size limits

**Cause:**
Prisma Client can be large when including all models

**Fix:**
```prisma
generator client {
  provider   = "prisma-client"
  output     = "./generated"
  engineType = "client"
  runtime    = "workerd"

  // Optional: Reduce bundle size
  previewFeatures = ["clientExtensions"]
}
```

Also consider using Prisma's tree-shaking features or splitting large schemas.

---

## Connection Pooling with Prisma Accelerate

### The Connection Pooling Challenge

Cloudflare Workers are **stateless** and **auto-scale** rapidly. Traditional connection pooling doesn't work well because:

- Workers spin up and down quickly
- Each worker isolate would create its own connections
- Database connection limits get exhausted quickly

### Current Setup (Direct Connections)

```typescript
// src/lib/db/client.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Limitations:**
- Each Worker creates its own database connection
- No connection pooling across Workers
- Can hit database connection limits under load

### Recommended: Prisma Accelerate (Future Enhancement)

For production at scale, consider [Prisma Accelerate](https://www.prisma.io/data-platform/accelerate):

```typescript
// With Prisma Accelerate
import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.ACCELERATE_DATABASE_URL, // Special Accelerate connection string
    },
  },
}).$extends(withAccelerate())
```

**Benefits:**
- Global connection pooling across all Workers
- Built-in query caching
- Reduced latency with edge caching
- No connection limit issues

**Cost:**
Paid service from Prisma ($29+/month)

---

## Local Development vs. Production

### Environment Setup

| Environment | Database | Prisma Client | Configuration |
|-------------|----------|---------------|---------------|
| **Local** | Docker PostgreSQL | Standard client | Works with both configs |
| **Staging** | Xata PostgreSQL | WASM client | Requires `workerd` config |
| **Production** | Xata PostgreSQL | WASM client | Requires `workerd` config |

### Single Configuration for All Environments

The good news: **the Cloudflare-compatible configuration works everywhere**!

```prisma
// This single config works in:
// - Local development (Docker PostgreSQL)
// - Cloudflare Workers staging
// - Cloudflare Workers production
generator client {
  provider   = "prisma-client"
  output     = "./generated"
  engineType = "client"
  runtime    = "workerd"
}
```

### Testing Locally

```bash
# Generate Prisma Client with workerd config
npx prisma generate

# Run migrations locally
npx prisma migrate dev --name your_migration_name

# Run development server (simulates Cloudflare Workers)
npm run dev

# Test that database queries work
# Open http://localhost:3000 and verify data loads
```

---

## Troubleshooting

### Regenerate Prisma Client After Config Changes

**Always regenerate** the Prisma Client after changing generator configuration:

```bash
# Delete old generated client
rm -rf node_modules/.prisma/client
rm -rf prisma/generated

# Regenerate with new settings
npx prisma generate

# Verify workerd-compatible client was generated
ls -la prisma/generated  # Should see workerd-specific files
```

### Verify Generated Client

Check that the generated client includes workerd compatibility:

```bash
# Look for workerd-specific files
cat prisma/generated/package.json | grep workerd

# Should see references to workerd runtime
```

### Debug 500 Errors in Production

If you're getting 500 errors in deployed Workers:

1. **Check Cloudflare Logs:**
   ```bash
   npx wrangler tail pm-staging  # For staging
   npx wrangler tail pm           # For production
   ```

2. **Look for Prisma-Related Errors:**
   - `Cannot find module`
   - `Invalid engine type`
   - `Query engine binary not found`

3. **Verify Environment Variables:**
   ```bash
   # Check DATABASE_URL is set correctly
   npx wrangler secret list --env staging
   ```

4. **Test with Fresh Build:**
   ```bash
   # Clean build
   rm -rf node_modules dist
   npm install
   npm run build

   # Check dist/server/wrangler.json has correct env config
   cat dist/server/wrangler.json
   ```

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot spawn query engine` | Missing `engineType = "client"` | Add to generator config |
| `Module not found: workerd` | Missing `runtime = "workerd"` | Add to generator config |
| `PrismaClientInitializationError` | Wrong DATABASE_URL | Check Cloudflare secrets |
| `Worker script too large` | Bundle size exceeded | Use Prisma tree-shaking or Accelerate |

---

## Testing Checklist

Before deploying to production, verify:

- [ ] `prisma/schema.prisma` has correct generator config
- [ ] `npx prisma generate` runs without errors
- [ ] Local dev server works with database queries
- [ ] Migrations applied to staging database
- [ ] Staging deployment successful (no 500 errors)
- [ ] Sample database queries work in staging
- [ ] Cloudflare logs show no Prisma errors

---

## Additional Resources

- [Prisma Cloudflare Workers Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-cloudflare-workers)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Prisma Client Edge](https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions)
- [Prisma Accelerate](https://www.prisma.io/data-platform/accelerate)

---

## Summary

### ✅ Key Takeaways

1. **Always use `engineType = "client"` and `runtime = "workerd"`** for Cloudflare Workers
2. **The same configuration works** for local development and production
3. **Regenerate Prisma Client** after any schema changes
4. **Test thoroughly** in staging before production deployment
5. **Monitor Cloudflare logs** for Prisma-related errors

### 🚨 Critical Reminder

**Without the correct Prisma configuration, your application will build successfully but fail in production with 500 errors.** Always verify your generator settings match the Cloudflare-compatible configuration documented here.

---

**Last Updated:** 2025-10-23
**Applies To:** PrintFarm Manager v1.0 (Epic 2+)
**Related Docs:** `CLOUDFLARE_SETUP.md`, `tech-spec-epic-2.md`

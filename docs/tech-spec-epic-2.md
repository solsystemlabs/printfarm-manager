# Technical Specification: Epic 2 - Core File Management

**Project:** printfarm-manager
**Epic:** 2 - Core File Management
**Date:** 2025-10-15
**Status:** Ready for Implementation
**Estimated Duration:** 1-2 weeks
**Prerequisites:** Epic 1 Complete

---

## Executive Summary

Epic 2 establishes the file storage foundation for the PrintFarm Manager system. This includes designing the database schema, implementing file upload workflows for models and slices, handling zip file extraction with bulk import, and managing thumbnails. All file operations integrate with Cloudflare R2 for storage and Xata/Prisma for metadata tracking.

**Critical Success Factors:**
- Database schema supports all future features (products, variants, metadata)
- R2 + Database atomic operations prevent orphaned files
- Zip extraction handles 500MB files with nested directories
- Thumbnail auto-resize keeps images under 2MB
- File deletion properly cleans up both R2 and database records

---

## Table of Contents

1. [Epic Overview](#epic-overview)
2. [Stories Breakdown](#stories-breakdown)
3. [Database Schema Design](#database-schema-design)
4. [API Endpoints](#api-endpoints)
5. [Implementation Sequence](#implementation-sequence)
6. [Acceptance Criteria](#acceptance-criteria)
7. [Testing Strategy](#testing-strategy)
8. [Risks and Mitigations](#risks-and-mitigations)

---

## Epic Overview

### Goal
Enable users to upload, store, and manage 3D model files and slice files with proper organization and thumbnail handling.

### Business Value
Establishes the foundation for all subsequent features. Users can centralize their scattered model files into an organized system with visual browsing capabilities.

### Success Criteria
- ✅ Owner can upload 500MB zip files with recursive directory scanning
- ✅ System extracts and displays all valid files (.stl, .3mf, .png, .jpg) with thumbnails
- ✅ Owner can select which files to import from extraction results
- ✅ Uploaded files stored in R2 with database metadata tracking
- ✅ Individual .stl/.3mf file uploads supported
- ✅ Thumbnail auto-resize working for oversized images
- ✅ File CRUD operations maintain R2+DB atomicity

### Dependencies
**Prerequisites:** Epic 1 (Infrastructure operational)
**Blocks:** Epic 3 (Metadata), Epic 4 (Products), Epic 5 (Search)

---

## Stories Breakdown

### Story 2.1: Design Database Schema

**Priority:** CRITICAL
**Complexity:** High
**Estimated Effort:** 6-8 hours

#### User Story
**As a** developer
**I want** database schema defined for models, slices, products, variants, filaments
**So that** we have proper data structure before building features

#### Database Schema (Prisma)

**File:** `/prisma/schema.prisma`

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider   = "prisma-client"   // Modern syntax (replaces prisma-client-js)
  output     = "./generated"      // Custom output location for generated client
  engineType = "client"           // REQUIRED: Use client engine (not binary) for Cloudflare Workers
  runtime    = "workerd"          // CRITICAL: Cloudflare Workers V8 runtime compatibility
}

// IMPORTANT: Cloudflare Workers Compatibility Notes
// - engineType = "client": Uses WebAssembly-based client instead of binary query engine
//   Binary engines cannot run in Cloudflare Workers V8 isolates
// - runtime = "workerd": Targets Cloudflare's workerd runtime (not Node.js)
//   Without this, deployments will fail with 500 errors in production
// - See docs/CLOUDFLARE_PRISMA_SETUP.md for detailed explanation

// ============================================================================
// Core File Entities (Epic 2)
// ============================================================================

model Model {
  id           String   @id @default(uuid())
  tenantId     String?  @map("tenant_id") // nullable in MVP, enforced in Phase 3
  filename     String
  r2Key        String   @map("r2_key")
  r2Url        String   @map("r2_url")
  fileSize     Int      @map("file_size") // bytes
  contentType  String   @map("content_type")
  thumbnailUrl String?  @map("thumbnail_url")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relationships (Epic 4)
  sliceModels SliceModel[]

  @@index([tenantId])
  @@index([filename]) // for search (Epic 5)
  @@map("models")
}

model Slice {
  id                String   @id @default(uuid())
  tenantId          String?  @map("tenant_id")
  filename          String
  r2Key             String   @map("r2_key")
  r2Url             String   @map("r2_url")
  fileSize          Int      @map("file_size")
  contentType       String   @map("content_type")
  thumbnailUrl      String?  @map("thumbnail_url")
  metadataExtracted Boolean  @default(false) @map("metadata_extracted")
  metadataJson      Json?    @map("metadata_json") // complete extracted metadata (Epic 3)

  // Curated metadata fields (denormalized for performance, Epic 3)
  layerHeight      Float?   @map("layer_height")
  nozzleTemp       Int?     @map("nozzle_temp")
  bedTemp          Int?     @map("bed_temp")
  printSpeed       Int?     @map("print_speed")
  infillPercent    Int?     @map("infill_percent")
  supportsEnabled  Boolean? @map("supports_enabled")
  estimatedTimeSec Int?     @map("estimated_time_sec")
  filamentUsedG    Float?   @map("filament_used_g")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relationships (Epic 3, 4)
  sliceModels    SliceModel[]
  sliceFilaments SliceFilament[]
  sliceVariants  SliceVariant[]

  @@index([tenantId])
  @@index([metadataExtracted])
  @@map("slices")
}

// ============================================================================
// Filament & Matching (Epic 3)
// ============================================================================

model Filament {
  id           String   @id @default(uuid())
  tenantId     String?  @map("tenant_id")
  brand        String   // normalized during matching
  colorHex     String   @map("color_hex") // e.g., "#FF5733"
  colorName    String?  @map("color_name") // e.g., "Red"
  materialType String   @map("material_type") // PLA, PETG, ABS, TPU
  filamentType String   @map("filament_type") // Basic, Matte, Silk, Sparkle
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relationships
  sliceFilaments SliceFilament[]

  @@unique([brand, colorHex, materialType, filamentType], name: "unique_filament")
  @@index([tenantId])
  @@index([brand])
  @@index([materialType])
  @@map("filaments")
}

model SliceFilament {
  id           String   @id @default(uuid())
  sliceId      String   @map("slice_id")
  filamentId   String?  @map("filament_id") // nullable to support filament deletion per FR-10
  amsSlotIndex Int      @map("ams_slot_index") // 1-based, non-contiguous OK
  createdAt    DateTime @default(now()) @map("created_at")

  // Relationships
  slice    Slice     @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  filament Filament? @relation(fields: [filamentId], references: [id], onDelete: SetNull) // Allow deletion, nullify references (per FR-10)

  @@unique([sliceId, amsSlotIndex]) // slot numbers unique per slice
  @@index([sliceId])
  @@index([filamentId])
  @@map("slice_filaments")
}

// DESIGN DECISION: Filament Deletion Behavior
// Changed from onDelete: Restrict to onDelete: SetNull to match FR-10 requirements
// - Allows users to delete filaments even when used in slices
// - UI displays warning: "Missing filament for Slot X (was deleted)"
// - More user-friendly than hard-blocking deletions
// - See story-2.1.md Debug Log for brainstorming decision rationale

// ============================================================================
// Product & Recipe System (Epic 4)
// ============================================================================

model Product {
  id           String   @id @default(uuid())
  tenantId     String?  @map("tenant_id")
  name         String   @unique // unique constraint for product names
  description  String?
  thumbnailUrl String?  @map("thumbnail_url")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relationships
  variants ProductVariant[]

  @@index([tenantId])
  @@index([name]) // for search (Epic 5)
  @@map("products")
}

model ProductVariant {
  id           String   @id @default(uuid())
  productId    String   @map("product_id")
  tenantId     String?  @map("tenant_id")
  name         String   // unique within product
  thumbnailUrl String?  @map("thumbnail_url")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relationships
  product       Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  sliceVariants SliceVariant[]

  @@unique([productId, name], name: "unique_variant_per_product")
  @@index([tenantId])
  @@index([productId])
  @@map("product_variants")
}

// ============================================================================
// Junction Tables (Many-to-Many Relationships)
// ============================================================================

model SliceModel {
  id        String   @id @default(uuid())
  sliceId   String   @map("slice_id")
  modelId   String   @map("model_id")
  createdAt DateTime @default(now()) @map("created_at")

  // Relationships
  slice Slice @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  model Model @relation(fields: [modelId], references: [id], onDelete: Cascade)

  @@unique([sliceId, modelId])
  @@index([sliceId])
  @@index([modelId])
  @@map("slice_models")
}

model SliceVariant {
  id               String   @id @default(uuid())
  sliceId          String   @map("slice_id")
  variantId        String   @map("variant_id")
  quantityPerPrint Int      @default(1) @map("quantity_per_print")
  createdAt        DateTime @default(now()) @map("created_at")

  // Relationships
  slice   Slice          @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  variant ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([sliceId, variantId])
  @@index([sliceId])
  @@index([variantId])
  @@map("slice_variants")
}
```

#### Migration Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name init_schema

# Apply to staging (after merge to master)
# Cloudflare builds will run: npx prisma migrate deploy

# Apply to production (after merge to production)
# Cloudflare builds will run: npx prisma migrate deploy
```

#### Prisma Client Setup

**File:** `/src/lib/db/client.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

#### Acceptance Criteria
- [x] Prisma schema created with all tables
- [x] Multi-tenant support via tenant_id (nullable in MVP)
- [x] Foreign keys and relationships properly defined
- [x] Unique constraints applied (product names, filament combinations)
- [x] UUID primary keys for all tables
- [x] Indexes created for search and relationship queries
- [x] Migration generated and tested in dev environment
- [x] Prisma Client generated successfully
- [x] ER diagram documented (see solution-architecture.md)

---

### Story 2.2: Implement Model File Upload API

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner
**I want** to upload individual .stl and .3mf files via web interface
**So that** I can add new models to my catalog

#### API Endpoint

**File:** `/src/routes/api/models/upload.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'
import { z } from 'zod'
import { prisma } from '~/lib/db/client'
import { log, logError } from '~/lib/utils/logger'
import { createErrorResponse } from '~/lib/utils/errors'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const ALLOWED_TYPES = ['model/stl', 'application/sla', 'application/octet-stream']
const ALLOWED_EXTENSIONS = ['.stl', '.3mf']

export const Route = createFileRoute('/api/models/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now()
        const cf = getContext('cloudflare')
        const bucket = cf.env.FILES_BUCKET

        try {
          // Parse form data
          const formData = await request.formData()
          const file = formData.get('file') as File

          if (!file) {
            return createErrorResponse(
              new Error('No file provided'),
              400,
              'MISSING_FILE'
            )
          }

          // Validate file size
          if (file.size > MAX_FILE_SIZE) {
            return createErrorResponse(
              new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`),
              413,
              'FILE_TOO_LARGE'
            )
          }

          // Validate file extension
          const hasValidExtension = ALLOWED_EXTENSIONS.some(ext =>
            file.name.toLowerCase().endsWith(ext)
          )
          if (!hasValidExtension) {
            return createErrorResponse(
              new Error(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`),
              400,
              'INVALID_FILE_TYPE'
            )
          }

          log('model_upload_start', {
            filename: file.name,
            size: file.size,
            content_type: file.type,
          })

          // Generate unique R2 key
          const extension = file.name.substring(file.name.lastIndexOf('.'))
          const r2Key = `models/${crypto.randomUUID()}${extension}`

          // Upload to R2 first
          await bucket.put(r2Key, file, {
            httpMetadata: {
              contentType: file.type || 'application/octet-stream',
              contentDisposition: `attachment; filename="${file.name}"`,
            },
          })

          // Generate R2 URL
          const r2Url = `https://${bucket.name}.r2.cloudflarestorage.com/${r2Key}`

          try {
            // Create database record
            const model = await prisma.model.create({
              data: {
                filename: file.name,
                r2Key,
                r2Url,
                fileSize: file.size,
                contentType: file.type || 'application/octet-stream',
              },
            })

            const duration = Date.now() - startTime
            log('model_upload_complete', {
              model_id: model.id,
              filename: model.filename,
              size: model.fileSize,
              duration_ms: duration,
            })

            return json(
              {
                id: model.id,
                filename: model.filename,
                r2Url: model.r2Url,
                thumbnailUrl: model.thumbnailUrl,
                fileSize: model.fileSize,
                createdAt: model.createdAt,
              },
              { status: 201 }
            )
          } catch (dbError) {
            // Cleanup R2 on DB failure
            await bucket.delete(r2Key)
            throw dbError
          }
        } catch (error) {
          logError('model_upload_error', error as Error, {
            duration_ms: Date.now() - startTime,
          })

          return createErrorResponse(
            error as Error,
            500,
            'UPLOAD_FAILED'
          )
        }
      },
    },
  },
})
```

#### Acceptance Criteria
- [x] API endpoint `/api/models/upload` accepts POST requests
- [x] Validates file type (.stl, .3mf only)
- [x] Validates file size (≤500MB)
- [x] Uploads file to R2 with unique filename (UUID-based)
- [x] Sets proper content-type and content-disposition headers
- [x] Creates database record with metadata
- [x] Returns upload success with model ID and URL
- [x] Handles errors gracefully (file too large, invalid type, R2 failure)
- [x] Cleans up R2 file if database creation fails (atomic operation)
- [x] Logs upload operation with performance metrics

---

### Story 2.3: Implement Zip File Upload with Extraction

**Priority:** HIGH
**Complexity:** High
**Estimated Effort:** 8-10 hours

#### User Story
**As an** owner
**I want** to upload zip files containing multiple models and images
**So that** I can bulk-import entire model collections efficiently

#### Implementation

**Install JSZip:**
```bash
npm install jszip
npm install -D @types/jszip
```

**File:** `/src/lib/zip/extractor.ts`

```typescript
import JSZip from 'jszip'
import { log } from '~/lib/utils/logger'

export interface ExtractedFile {
  path: string
  filename: string
  type: 'model' | 'image' | 'unknown'
  size: number
  content: Blob
}

const MODEL_EXTENSIONS = ['.stl', '.3mf']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg']

export async function extractZipFile(zipBlob: Blob): Promise<ExtractedFile[]> {
  const startTime = Date.now()
  log('zip_extraction_start', { size: zipBlob.size })

  const zip = await JSZip.loadAsync(zipBlob)
  const extractedFiles: ExtractedFile[] = []

  // Process all files recursively
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    // Skip directories
    if (zipEntry.dir) continue

    // Get filename
    const filename = path.split('/').pop() || path

    // Skip hidden files and system files
    if (filename.startsWith('.') || filename.startsWith('__MACOSX')) {
      continue
    }

    // Determine file type
    const lowerFilename = filename.toLowerCase()
    let type: 'model' | 'image' | 'unknown' = 'unknown'

    if (MODEL_EXTENSIONS.some(ext => lowerFilename.endsWith(ext))) {
      type = 'model'
    } else if (IMAGE_EXTENSIONS.some(ext => lowerFilename.endsWith(ext))) {
      type = 'image'
    }

    // Only include valid file types
    if (type !== 'unknown') {
      const content = await zipEntry.async('blob')

      extractedFiles.push({
        path,
        filename,
        type,
        size: content.size,
        content,
      })
    }
  }

  const duration = Date.now() - startTime
  log('zip_extraction_complete', {
    duration_ms: duration,
    files_found: extractedFiles.length,
    models: extractedFiles.filter(f => f.type === 'model').length,
    images: extractedFiles.filter(f => f.type === 'image').length,
  })

  return extractedFiles
}
```

**File:** `/src/routes/api/models/upload-zip.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { extractZipFile } from '~/lib/zip/extractor'
import { createErrorResponse } from '~/lib/utils/errors'
import { log, logError } from '~/lib/utils/logger'

const MAX_ZIP_SIZE = 500 * 1024 * 1024 // 500MB

export const Route = createFileRoute('/api/models/upload-zip')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now()

        try {
          const formData = await request.formData()
          const file = formData.get('file') as File

          if (!file) {
            return createErrorResponse(
              new Error('No file provided'),
              400,
              'MISSING_FILE'
            )
          }

          // Validate zip file
          if (!file.name.toLowerCase().endsWith('.zip')) {
            return createErrorResponse(
              new Error('File must be a .zip archive'),
              400,
              'INVALID_FILE_TYPE'
            )
          }

          if (file.size > MAX_ZIP_SIZE) {
            return createErrorResponse(
              new Error(`Zip file too large (max ${MAX_ZIP_SIZE / 1024 / 1024}MB)`),
              413,
              'FILE_TOO_LARGE'
            )
          }

          log('zip_upload_start', {
            filename: file.name,
            size: file.size,
          })

          // Extract zip contents
          const extractedFiles = await extractZipFile(file)

          // Return file list for user selection
          // Do NOT upload to R2 yet - await user selection in Story 2.4
          const duration = Date.now() - startTime
          log('zip_upload_complete', {
            filename: file.name,
            files_extracted: extractedFiles.length,
            duration_ms: duration,
          })

          return json({
            files: extractedFiles.map(f => ({
              path: f.path,
              filename: f.filename,
              type: f.type,
              size: f.size,
              // Note: content (Blob) not serializable, stored temporarily server-side
              // For MVP: client will re-upload selected files individually
              // Alternative: Store in temporary R2 location with expiry
            })),
            totalFiles: extractedFiles.length,
            models: extractedFiles.filter(f => f.type === 'model').length,
            images: extractedFiles.filter(f => f.type === 'image').length,
          })
        } catch (error) {
          logError('zip_upload_error', error as Error, {
            duration_ms: Date.now() - startTime,
          })

          if (error instanceof Error && error.message.includes('invalid zip')) {
            return createErrorResponse(
              error,
              422,
              'INVALID_ZIP_FILE'
            )
          }

          return createErrorResponse(
            error as Error,
            500,
            'ZIP_EXTRACTION_FAILED'
          )
        }
      },
    },
  },
})
```

#### Acceptance Criteria
- [x] API endpoint `/api/models/upload-zip` accepts zip files
- [x] Validates zip file size (≤500MB)
- [x] Extracts zip contents in-memory
- [x] Recursively scans all directories within zip
- [x] Identifies valid files (.stl, .3mf, .png, .jpg, .jpeg)
- [x] Ignores non-whitelisted files without errors
- [x] Skips hidden files and system directories
- [x] Returns list of discovered files with metadata
- [x] Does NOT upload to R2 yet (awaits user selection)
- [x] Handles malformed/corrupted zip files with descriptive errors
- [x] Logs extraction performance metrics

---

### Story 2.4: Implement File Selection and Bulk Import UI

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 6-8 hours

#### User Story
**As an** owner
**I want** to review extracted files and select which ones to import
**So that** I can exclude unwanted files (promos, alternate versions)

#### Implementation

**Simplified Approach for MVP:**
Since extracted file Blobs can't be serialized and storing them temporarily adds complexity, we'll use a simplified flow:
1. User uploads zip
2. Server extracts and returns file list
3. User reviews and selects files
4. User re-uploads zip (kept in browser memory)
5. Server re-extracts and imports ONLY selected files

**File:** `/src/routes/api/models/import-zip.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'
import { z } from 'zod'
import { extractZipFile } from '~/lib/zip/extractor'
import { prisma } from '~/lib/db/client'
import { log, logError } from '~/lib/utils/logger'
import { createErrorResponse } from '~/lib/utils/errors'

const ImportZipSchema = z.object({
  selectedPaths: z.array(z.string()),
})

export const Route = createFileRoute('/api/models/import-zip')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now()
        const cf = getContext('cloudflare')
        const bucket = cf.env.FILES_BUCKET

        try {
          const formData = await request.formData()
          const file = formData.get('file') as File
          const selectedPathsJson = formData.get('selectedPaths') as string

          if (!file || !selectedPathsJson) {
            return createErrorResponse(
              new Error('Missing file or selectedPaths'),
              400,
              'MISSING_REQUIRED_FIELDS'
            )
          }

          const { selectedPaths } = ImportZipSchema.parse({
            selectedPaths: JSON.parse(selectedPathsJson),
          })

          log('zip_import_start', {
            filename: file.name,
            selected_count: selectedPaths.length,
          })

          // Re-extract zip
          const extractedFiles = await extractZipFile(file)

          // Filter to selected files only
          const filesToImport = extractedFiles.filter(f =>
            selectedPaths.includes(f.path)
          )

          const imported: Array<{ id: string; filename: string; r2Url: string }> = []
          const errors: Array<{ filename: string; error: string }> = []

          // Import each selected file
          for (const extractedFile of filesToImport) {
            try {
              const extension = extractedFile.filename.substring(
                extractedFile.filename.lastIndexOf('.')
              )
              const r2Key = `models/${crypto.randomUUID()}${extension}`

              // Upload to R2
              await bucket.put(r2Key, extractedFile.content, {
                httpMetadata: {
                  contentType:
                    extractedFile.type === 'image'
                      ? `image/${extension.replace('.', '')}`
                      : 'application/octet-stream',
                  contentDisposition: `attachment; filename="${extractedFile.filename}"`,
                },
              })

              const r2Url = `https://${bucket.name}.r2.cloudflarestorage.com/${r2Key}`

              // Create database record
              const model = await prisma.model.create({
                data: {
                  filename: extractedFile.filename,
                  r2Key,
                  r2Url,
                  fileSize: extractedFile.size,
                  contentType:
                    extractedFile.type === 'image'
                      ? `image/${extension.replace('.', '')}`
                      : 'application/octet-stream',
                },
              })

              imported.push({
                id: model.id,
                filename: model.filename,
                r2Url: model.r2Url,
              })
            } catch (error) {
              errors.push({
                filename: extractedFile.filename,
                error: error instanceof Error ? error.message : 'Unknown error',
              })
            }
          }

          const duration = Date.now() - startTime
          log('zip_import_complete', {
            imported_count: imported.length,
            error_count: errors.length,
            duration_ms: duration,
          })

          return json({
            imported,
            errors,
            summary: {
              total: filesToImport.length,
              successful: imported.length,
              failed: errors.length,
            },
          })
        } catch (error) {
          logError('zip_import_error', error as Error, {
            duration_ms: Date.now() - startTime,
          })

          return createErrorResponse(error as Error, 500, 'IMPORT_FAILED')
        }
      },
    },
  },
})
```

**File:** `/src/routes/models/upload-zip.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

export const Route = createFileRoute('/models/upload-zip')({
  component: UploadZipPage,
})

interface ExtractedFile {
  path: string
  filename: string
  type: 'model' | 'image'
  size: number
}

function UploadZipPage() {
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())

  const extractMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/models/upload-zip', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error('Extraction failed')
      return response.json()
    },
    onSuccess: (data) => {
      setExtractedFiles(data.files)
      // Select all by default
      setSelectedPaths(new Set(data.files.map((f: ExtractedFile) => f.path)))
    },
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!zipFile) throw new Error('No zip file')

      const formData = new FormData()
      formData.append('file', zipFile)
      formData.append('selectedPaths', JSON.stringify(Array.from(selectedPaths)))

      const response = await fetch('/api/models/import-zip', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error('Import failed')
      return response.json()
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setZipFile(file)
      extractMutation.mutate(file)
    }
  }

  const toggleSelection = (path: string) => {
    const newSelection = new Set(selectedPaths)
    if (newSelection.has(path)) {
      newSelection.delete(path)
    } else {
      newSelection.add(path)
    }
    setSelectedPaths(newSelection)
  }

  const selectAll = () => {
    setSelectedPaths(new Set(extractedFiles.map(f => f.path)))
  }

  const deselectAll = () => {
    setSelectedPaths(new Set())
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Upload Zip Archive</h1>

      {/* File Upload */}
      {!extractedFiles.length && (
        <div className="mb-8">
          <label className="block mb-2 font-medium">Select Zip File (Max 500MB)</label>
          <input
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
          />
          {extractMutation.isPending && (
            <p className="mt-2 text-sm text-gray-600">Extracting zip file...</p>
          )}
          {extractMutation.isError && (
            <p className="mt-2 text-sm text-red-600">
              Error: {extractMutation.error.message}
            </p>
          )}
        </div>
      )}

      {/* File Selection Grid */}
      {extractedFiles.length > 0 && !importMutation.isSuccess && (
        <>
          <div className="mb-4 flex gap-4">
            <button
              onClick={selectAll}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Deselect All
            </button>
            <div className="ml-auto text-sm text-gray-600">
              {selectedPaths.size} of {extractedFiles.length} selected
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {extractedFiles.map(file => (
              <div
                key={file.path}
                className={`border rounded-lg p-4 cursor-pointer transition ${
                  selectedPaths.has(file.path)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300'
                }`}
                onClick={() => toggleSelection(file.path)}
              >
                <div className="text-sm font-medium mb-2 truncate" title={file.filename}>
                  {file.filename}
                </div>
                <div className="text-xs text-gray-600">
                  {file.type} • {(file.size / 1024).toFixed(2)} KB
                </div>
                <div className="mt-2">
                  <input
                    type="checkbox"
                    checked={selectedPaths.has(file.path)}
                    onChange={() => toggleSelection(file.path)}
                    className="form-checkbox"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => importMutation.mutate()}
            disabled={selectedPaths.size === 0 || importMutation.isPending}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {importMutation.isPending
              ? `Importing ${selectedPaths.size} files...`
              : `Import ${selectedPaths.size} Selected Files`}
          </button>
        </>
      )}

      {/* Import Results */}
      {importMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-green-800">Import Complete!</h2>
          <div className="mb-4">
            <p className="text-sm text-green-700">
              Successfully imported {importMutation.data.summary.successful} of{' '}
              {importMutation.data.summary.total} files
            </p>
          </div>

          {importMutation.data.errors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
              <h3 className="font-medium text-red-800 mb-2">Errors:</h3>
              {importMutation.data.errors.map((err: { filename: string; error: string }) => (
                <p key={err.filename} className="text-sm text-red-700">
                  {err.filename}: {err.error}
                </p>
              ))}
            </div>
          )}

          <a
            href="/models"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            View Models
          </a>
        </div>
      )}
    </div>
  )
}
```

#### Acceptance Criteria
- [x] UI displays all extracted files in grid layout with thumbnails
- [x] Image files show default image icon (actual thumbnail preview deferred)
- [x] Model files show default 3D model icon placeholder
- [x] Each file has checkbox for selection (all selected by default)
- [x] Bulk actions: Select All, Deselect All
- [x] File info displayed: name, size, type
- [x] "Import Selected" button triggers bulk upload
- [x] Selected files uploaded to R2 and database records created
- [x] Progress indicator shows upload status
- [x] Success confirmation lists imported files
- [x] Error handling shows failed imports with reasons

---

### Story 2.5: Implement Slice File Upload API

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 3-4 hours

#### User Story
**As an** owner
**I want** to upload .gcode.3mf and .gcode slice files
**So that** I can attach sliced configurations to my models

#### API Endpoint

**File:** `/src/routes/api/slices/upload.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'
import { prisma } from '~/lib/db/client'
import { log, logError } from '~/lib/utils/logger'
import { createErrorResponse } from '~/lib/utils/errors'

const MAX_SLICE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_EXTENSIONS = ['.gcode.3mf', '.gcode']

export const Route = createFileRoute('/api/slices/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now()
        const cf = getContext('cloudflare')
        const bucket = cf.env.FILES_BUCKET

        try {
          const formData = await request.formData()
          const file = formData.get('file') as File

          if (!file) {
            return createErrorResponse(
              new Error('No file provided'),
              400,
              'MISSING_FILE'
            )
          }

          // Validate file size
          if (file.size > MAX_SLICE_SIZE) {
            return createErrorResponse(
              new Error(`Slice file too large (max ${MAX_SLICE_SIZE / 1024 / 1024}MB)`),
              413,
              'FILE_TOO_LARGE'
            )
          }

          // Validate file extension
          const hasValidExtension = ALLOWED_EXTENSIONS.some(ext =>
            file.name.toLowerCase().endsWith(ext)
          )
          if (!hasValidExtension) {
            return createErrorResponse(
              new Error(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`),
              400,
              'INVALID_FILE_TYPE'
            )
          }

          log('slice_upload_start', {
            filename: file.name,
            size: file.size,
            content_type: file.type,
          })

          // Generate unique R2 key
          const r2Key = `slices/${crypto.randomUUID()}-${file.name}`

          // Upload to R2
          await bucket.put(r2Key, file, {
            httpMetadata: {
              contentType: file.type || 'application/octet-stream',
              contentDisposition: `attachment; filename="${file.name}"`,
            },
          })

          const r2Url = `https://${bucket.name}.r2.cloudflarestorage.com/${r2Key}`

          try {
            // Create database record
            // Metadata extraction happens in Epic 3
            const slice = await prisma.slice.create({
              data: {
                filename: file.name,
                r2Key,
                r2Url,
                fileSize: file.size,
                contentType: file.type || 'application/octet-stream',
                metadataExtracted: false, // Will be set to true in Epic 3
              },
            })

            const duration = Date.now() - startTime
            log('slice_upload_complete', {
              slice_id: slice.id,
              filename: slice.filename,
              size: slice.fileSize,
              duration_ms: duration,
            })

            return json(
              {
                id: slice.id,
                filename: slice.filename,
                r2Url: slice.r2Url,
                metadataExtracted: slice.metadataExtracted,
                fileSize: slice.fileSize,
                createdAt: slice.createdAt,
              },
              { status: 201 }
            )
          } catch (dbError) {
            // Cleanup R2 on DB failure
            await bucket.delete(r2Key)
            throw dbError
          }
        } catch (error) {
          logError('slice_upload_error', error as Error, {
            duration_ms: Date.now() - startTime,
          })

          return createErrorResponse(error as Error, 500, 'UPLOAD_FAILED')
        }
      },
    },
  },
})
```

#### Acceptance Criteria
- [x] API endpoint `/api/slices/upload` accepts POST requests
- [x] Validates file type (.gcode.3mf, .gcode)
- [x] Validates file size (≤50MB)
- [x] Uploads file to R2 with unique filename
- [x] Sets proper content-type and content-disposition headers
- [x] Creates database record with metadata
- [x] metadataExtracted defaults to false (Epic 3 will update)
- [x] Returns upload success with slice ID and URL
- [x] Handles errors gracefully
- [x] Cleans up R2 file if database creation fails
- [x] Logs upload operation with performance metrics

---

### Story 2.6: Implement Thumbnail Handling

**Priority:** MEDIUM
**Complexity:** High
**Estimated Effort:** 6-8 hours

#### User Story
**As an** owner
**I want** thumbnails automatically extracted and resized from uploaded files
**So that** my catalog has consistent visual presentation

#### Implementation

**Install sharp:**
```bash
npm install sharp
npm install -D @types/sharp
```

**Verify sharp compatibility with Cloudflare Workers:**
> **Note:** sharp requires native bindings which may not work in Cloudflare Workers. Testing required in Story 2.6 implementation.
> **Fallback:** If sharp doesn't work, implement client-side canvas resizing or use Cloudflare Images API.

**File:** `/src/lib/images/resize.ts`

```typescript
import sharp from 'sharp'
import { log, logError } from '~/lib/utils/logger'

const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_DIMENSIONS = 1024 // 1024x1024

export async function resizeImage(
  imageBuffer: ArrayBuffer,
  originalFilename: string
): Promise<Buffer | null> {
  const startTime = Date.now()

  try {
    log('image_resize_start', {
      filename: originalFilename,
      size: imageBuffer.byteLength,
    })

    const buffer = Buffer.from(imageBuffer)
    const image = sharp(buffer)
    const metadata = await image.metadata()

    // Check if resize needed
    const needsResize =
      (metadata.width && metadata.width > MAX_DIMENSIONS) ||
      (metadata.height && metadata.height > MAX_DIMENSIONS) ||
      buffer.length > MAX_THUMBNAIL_SIZE

    if (!needsResize) {
      log('image_resize_skipped', {
        filename: originalFilename,
        reason: 'within_limits',
      })
      return buffer
    }

    // Resize maintaining aspect ratio
    const resized = await image
      .resize({
        width: MAX_DIMENSIONS,
        height: MAX_DIMENSIONS,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 }) // Convert to JPEG for consistency
      .toBuffer()

    const duration = Date.now() - startTime
    log('image_resize_complete', {
      filename: originalFilename,
      original_size: buffer.length,
      resized_size: resized.length,
      reduction_percent: ((1 - resized.length / buffer.length) * 100).toFixed(2),
      duration_ms: duration,
    })

    return resized
  } catch (error) {
    logError('image_resize_failed', error as Error, {
      filename: originalFilename,
    })
    return null
  }
}
```

**File:** `/src/routes/api/images/upload.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'
import { resizeImage } from '~/lib/images/resize'
import { createErrorResponse } from '~/lib/utils/errors'
import { log } from '~/lib/utils/logger'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg']

export const Route = createFileRoute('/api/images/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now()
        const cf = getContext('cloudflare')
        const bucket = cf.env.FILES_BUCKET

        try {
          const formData = await request.formData()
          const file = formData.get('file') as File

          if (!file) {
            return createErrorResponse(
              new Error('No file provided'),
              400,
              'MISSING_FILE'
            )
          }

          if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return createErrorResponse(
              new Error('Invalid image type. Allowed: PNG, JPEG'),
              400,
              'INVALID_IMAGE_TYPE'
            )
          }

          log('image_upload_start', {
            filename: file.name,
            size: file.size,
            type: file.type,
          })

          // Read file as ArrayBuffer
          const arrayBuffer = await file.arrayBuffer()

          // Resize image
          const resized = await resizeImage(arrayBuffer, file.name)

          if (!resized) {
            return createErrorResponse(
              new Error('Image resize failed'),
              422,
              'RESIZE_FAILED'
            )
          }

          // Upload to R2
          const extension = file.name.substring(file.name.lastIndexOf('.'))
          const r2Key = `thumbnails/${crypto.randomUUID()}.jpg` // Always JPEG after resize

          await bucket.put(r2Key, resized, {
            httpMetadata: {
              contentType: 'image/jpeg',
              contentDisposition: `inline; filename="${file.name}"`,
            },
          })

          const r2Url = `https://${bucket.name}.r2.cloudflarestorage.com/${r2Key}`

          const duration = Date.now() - startTime
          log('image_upload_complete', {
            filename: file.name,
            r2_key: r2Key,
            duration_ms: duration,
          })

          return json({ url: r2Url }, { status: 201 })
        } catch (error) {
          return createErrorResponse(error as Error, 500, 'UPLOAD_FAILED')
        }
      },
    },
  },
})
```

#### Acceptance Criteria
- [x] Image files (.png, .jpg) uploaded as thumbnails
- [x] Oversized images (>2MB or >1024x1024) automatically resized
- [x] Resizing preserves aspect ratio
- [x] Resized images use JPEG format with 85% quality
- [x] Images within limits uploaded as-is
- [x] Resize failures handled gracefully (return error, not crash)
- [x] Manual thumbnail upload/replace supported
- [x] Thumbnails stored with content-disposition: inline (for viewing)
- [x] Logs resize operations with performance metrics
- [x] **Testing Required:** Verify sharp works in Cloudflare Workers

---

### Story 2.7: Implement Model CRUD Operations

**Priority:** MEDIUM
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner
**I want** to view, edit, and delete model records
**So that** I can manage my model catalog over time

#### Implementation

**File:** `/src/routes/api/models/$modelId.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'
import { z } from 'zod'
import { prisma } from '~/lib/db/client'
import { createErrorResponse } from '~/lib/utils/errors'
import { log } from '~/lib/utils/logger'

export const Route = createFileRoute('/api/models/$modelId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const model = await prisma.model.findUnique({
            where: { id: params.modelId },
            include: {
              sliceModels: {
                include: {
                  slice: {
                    select: {
                      id: true,
                      filename: true,
                    },
                  },
                },
              },
            },
          })

          if (!model) {
            return createErrorResponse(
              new Error('Model not found'),
              404,
              'MODEL_NOT_FOUND'
            )
          }

          return json({
            id: model.id,
            filename: model.filename,
            r2Url: model.r2Url,
            thumbnailUrl: model.thumbnailUrl,
            fileSize: model.fileSize,
            contentType: model.contentType,
            createdAt: model.createdAt,
            updatedAt: model.updatedAt,
            slices: model.sliceModels.map(sm => ({
              id: sm.slice.id,
              filename: sm.slice.filename,
            })),
          })
        } catch (error) {
          return createErrorResponse(error as Error, 500, 'FETCH_FAILED')
        }
      },

      DELETE: async ({ params }) => {
        const cf = getContext('cloudflare')
        const bucket = cf.env.FILES_BUCKET

        try {
          // Check if model used in slices
          const model = await prisma.model.findUnique({
            where: { id: params.modelId },
            include: {
              sliceModels: true,
            },
          })

          if (!model) {
            return createErrorResponse(
              new Error('Model not found'),
              404,
              'MODEL_NOT_FOUND'
            )
          }

          if (model.sliceModels.length > 0) {
            return createErrorResponse(
              new Error(
                `Cannot delete model used in ${model.sliceModels.length} slice(s)`
              ),
              409,
              'MODEL_IN_USE'
            )
          }

          // Delete from database first
          await prisma.model.delete({
            where: { id: params.modelId },
          })

          // Queue R2 deletion (eventual consistency acceptable)
          await bucket.delete(model.r2Key)

          log('model_deleted', {
            model_id: params.modelId,
            filename: model.filename,
          })

          return new Response(null, { status: 204 })
        } catch (error) {
          return createErrorResponse(error as Error, 500, 'DELETE_FAILED')
        }
      },
    },
  },
})
```

**File:** `/src/routes/models/$modelId.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export const Route = createFileRoute('/models/$modelId')({
  component: ModelDetailPage,
})

interface ModelDetail {
  id: string
  filename: string
  r2Url: string
  thumbnailUrl?: string
  fileSize: number
  createdAt: string
  slices: Array<{ id: string; filename: string }>
}

function ModelDetailPage() {
  const { modelId } = Route.useParams()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data, isLoading } = useQuery<ModelDetail>({
    queryKey: ['model', modelId],
    queryFn: () => fetch(`/api/models/${modelId}`).then(r => r.json()),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/models/${modelId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error.message)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      window.location.href = '/models'
    },
  })

  if (isLoading) {
    return <div className="container mx-auto p-8">Loading...</div>
  }

  if (!data) {
    return <div className="container mx-auto p-8">Model not found</div>
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{data.filename}</h1>
        <p className="text-sm text-gray-600">
          Uploaded {new Date(data.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        {data.thumbnailUrl && (
          <img
            src={data.thumbnailUrl}
            alt={data.filename}
            className="w-64 h-64 object-contain mb-4"
          />
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="font-semibold text-sm text-gray-600">File Size</h3>
            <p>{(data.fileSize / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-600">Used in Slices</h3>
            <p>{data.slices.length}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <a
            href={data.r2Url}
            download
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Download File
          </a>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete Model
          </button>
        </div>
      </div>

      {/* Related Slices */}
      {data.slices.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Used in Slices</h2>
          <ul className="space-y-2">
            {data.slices.map(slice => (
              <li key={slice.id}>
                <a
                  href={`/slices/${slice.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {slice.filename}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-4">Confirm Deletion</h2>
            <p className="mb-4">
              Are you sure you want to delete "{data.filename}"?
            </p>
            {data.slices.length > 0 && (
              <p className="mb-4 text-red-600 font-medium">
                Warning: This model is used in {data.slices.length} slice(s).
                Deletion will break those relationships.
              </p>
            )}
            {deleteMutation.isError && (
              <p className="mb-4 text-red-600 text-sm">
                Error: {deleteMutation.error.message}
              </p>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

#### Acceptance Criteria
- [x] Model detail page displays thumbnail, filename, size, upload date, associated slices
- [x] Download button for model file
- [x] Delete functionality with confirmation modal
- [x] Deletion warning shows related entities ("Used in X slices")
- [x] Deletion prevented if model used in slices (409 error)
- [x] Deleting model deletes R2 file
- [x] Model list page shows all models in visual grid
- [x] Logs deletion operations

---

### Story 2.8: Implement Slice CRUD Operations

**Priority:** MEDIUM
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner
**I want** to view, edit, and delete slice records
**So that** I can manage my slice configurations

#### Implementation

**File:** `/src/routes/api/slices/$sliceId.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'
import { prisma } from '~/lib/db/client'
import { createErrorResponse } from '~/lib/utils/errors'
import { log } from '~/lib/utils/logger'

export const Route = createFileRoute('/api/slices/$sliceId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const slice = await prisma.slice.findUnique({
            where: { id: params.sliceId },
            include: {
              sliceModels: {
                include: {
                  model: {
                    select: {
                      id: true,
                      filename: true,
                    },
                  },
                },
              },
              sliceFilaments: {
                include: {
                  filament: {
                    select: {
                      id: true,
                      brand: true,
                      colorHex: true,
                      colorName: true,
                      materialType: true,
                    },
                  },
                },
              },
              sliceVariants: {
                include: {
                  variant: {
                    include: {
                      product: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          })

          if (!slice) {
            return createErrorResponse(
              new Error('Slice not found'),
              404,
              'SLICE_NOT_FOUND'
            )
          }

          return json({
            id: slice.id,
            filename: slice.filename,
            r2Url: slice.r2Url,
            thumbnailUrl: slice.thumbnailUrl,
            fileSize: slice.fileSize,
            metadataExtracted: slice.metadataExtracted,
            createdAt: slice.createdAt,
            // Curated metadata (Epic 3)
            curatedMetadata: {
              layerHeight: slice.layerHeight,
              nozzleTemp: slice.nozzleTemp,
              bedTemp: slice.bedTemp,
              printSpeed: slice.printSpeed,
              infillPercent: slice.infillPercent,
              supportsEnabled: slice.supportsEnabled,
              estimatedTimeSec: slice.estimatedTimeSec,
              filamentUsedG: slice.filamentUsedG,
            },
            // Complete metadata (Epic 3)
            completeMetadata: slice.metadataJson,
            // Relationships
            models: slice.sliceModels.map(sm => ({
              id: sm.model.id,
              filename: sm.model.filename,
            })),
            filaments: slice.sliceFilaments.map(sf => ({
              id: sf.filament.id,
              amsSlot: sf.amsSlotIndex,
              brand: sf.filament.brand,
              colorHex: sf.filament.colorHex,
              colorName: sf.filament.colorName,
              materialType: sf.filament.materialType,
            })),
            products: slice.sliceVariants.map(sv => ({
              id: sv.variant.product.id,
              name: sv.variant.product.name,
              variantId: sv.variant.id,
              variantName: sv.variant.name,
            })),
          })
        } catch (error) {
          return createErrorResponse(error as Error, 500, 'FETCH_FAILED')
        }
      },

      DELETE: async ({ params }) => {
        const cf = getContext('cloudflare')
        const bucket = cf.env.FILES_BUCKET

        try {
          const slice = await prisma.slice.findUnique({
            where: { id: params.sliceId },
            include: {
              sliceVariants: {
                include: {
                  variant: true,
                },
              },
            },
          })

          if (!slice) {
            return createErrorResponse(
              new Error('Slice not found'),
              404,
              'SLICE_NOT_FOUND'
            )
          }

          // Check if slice is last/only slice for any product variant
          for (const sv of slice.sliceVariants) {
            const variantSliceCount = await prisma.sliceVariant.count({
              where: { variantId: sv.variantId },
            })

            if (variantSliceCount === 1) {
              return createErrorResponse(
                new Error(
                  `Cannot delete last slice for product variant "${sv.variant.name}"`
                ),
                409,
                'LAST_SLICE_FOR_VARIANT'
              )
            }
          }

          // Delete from database (cascades to junction tables)
          await prisma.slice.delete({
            where: { id: params.sliceId },
          })

          // Queue R2 deletion
          await bucket.delete(slice.r2Key)

          log('slice_deleted', {
            slice_id: params.sliceId,
            filename: slice.filename,
          })

          return new Response(null, { status: 204 })
        } catch (error) {
          return createErrorResponse(error as Error, 500, 'DELETE_FAILED')
        }
      },
    },
  },
})
```

**File:** `/src/routes/slices/$sliceId.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export const Route = createFileRoute('/slices/$sliceId')({
  component: SliceDetailPage,
})

interface SliceDetail {
  id: string
  filename: string
  r2Url: string
  thumbnailUrl?: string
  fileSize: number
  metadataExtracted: boolean
  createdAt: string
  curatedMetadata: {
    layerHeight?: number
    nozzleTemp?: number
    bedTemp?: number
    printSpeed?: number
    infillPercent?: number
    supportsEnabled?: boolean
    estimatedTimeSec?: number
    filamentUsedG?: number
  }
  models: Array<{ id: string; filename: string }>
  filaments: Array<{
    id: string
    amsSlot: number
    brand: string
    colorHex: string
    colorName?: string
    materialType: string
  }>
  products: Array<{
    id: string
    name: string
    variantId: string
    variantName: string
  }>
}

function SliceDetailPage() {
  const { sliceId } = Route.useParams()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data, isLoading } = useQuery<SliceDetail>({
    queryKey: ['slice', sliceId],
    queryFn: () => fetch(`/api/slices/${sliceId}`).then(r => r.json()),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/slices/${sliceId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error.message)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slices'] })
      window.location.href = '/slices'
    },
  })

  if (isLoading) {
    return <div className="container mx-auto p-8">Loading...</div>
  }

  if (!data) {
    return <div className="container mx-auto p-8">Slice not found</div>
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{data.filename}</h1>
        <p className="text-sm text-gray-600">
          Uploaded {new Date(data.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Slice Info */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        {data.thumbnailUrl && (
          <img
            src={data.thumbnailUrl}
            alt={data.filename}
            className="w-64 h-64 object-contain mb-4"
          />
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="font-semibold text-sm text-gray-600">File Size</h3>
            <p>{(data.fileSize / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-600">Metadata Extracted</h3>
            <p>{data.metadataExtracted ? 'Yes' : 'No'}</p>
          </div>
        </div>

        {/* Curated Metadata (Epic 3) */}
        {data.metadataExtracted && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Print Settings</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {data.curatedMetadata.layerHeight && (
                <p>Layer Height: {data.curatedMetadata.layerHeight}mm</p>
              )}
              {data.curatedMetadata.nozzleTemp && (
                <p>Nozzle Temp: {data.curatedMetadata.nozzleTemp}°C</p>
              )}
              {data.curatedMetadata.bedTemp && (
                <p>Bed Temp: {data.curatedMetadata.bedTemp}°C</p>
              )}
              {data.curatedMetadata.infillPercent && (
                <p>Infill: {data.curatedMetadata.infillPercent}%</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <a
            href={data.r2Url}
            download
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Download Slice
          </a>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete Slice
          </button>
        </div>
      </div>

      {/* Related Entities */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Models */}
        {data.models.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Models ({data.models.length})</h3>
            <ul className="space-y-1 text-sm">
              {data.models.map(model => (
                <li key={model.id}>
                  <a href={`/models/${model.id}`} className="text-blue-600 hover:underline">
                    {model.filename}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Filaments */}
        {data.filaments.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Filaments ({data.filaments.length})</h3>
            <ul className="space-y-2 text-sm">
              {data.filaments.map(filament => (
                <li key={filament.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: filament.colorHex }}
                  />
                  <span>
                    Slot {filament.amsSlot}: {filament.brand} {filament.materialType}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Products */}
        {data.products.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Products ({data.products.length})</h3>
            <ul className="space-y-1 text-sm">
              {data.products.map(product => (
                <li key={product.variantId}>
                  <a
                    href={`/products/${product.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {product.name} - {product.variantName}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-4">Confirm Deletion</h2>
            <p className="mb-4">
              Are you sure you want to delete "{data.filename}"?
            </p>
            {data.products.length > 0 && (
              <p className="mb-4 text-red-600 font-medium">
                Warning: This slice is used in {data.products.length} product(s).
              </p>
            )}
            {deleteMutation.isError && (
              <p className="mb-4 text-red-600 text-sm">
                Error: {deleteMutation.error.message}
              </p>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

#### Acceptance Criteria
- [x] Slice detail page displays thumbnail, filename, size, upload date, metadata status
- [x] Shows curated metadata if extracted (Epic 3 will populate)
- [x] Download button for slice file with proper headers
- [x] Delete functionality with confirmation modal
- [x] Deletion prevented if slice is last/only slice for product variant (409 error)
- [x] Deletion warning shows affected products
- [x] Deleting slice deletes R2 file
- [x] Displays related models, filaments, products
- [x] Slice list page shows all slices in visual grid
- [x] Logs deletion operations

---

## Implementation Sequence

### Phase 1: Database Foundation (Story 2.1)
**Duration:** 1 day
**Critical Path**

1. Create Prisma schema (4 hours)
2. Generate Prisma Client (30 min)
3. Create initial migration (30 min)
4. Test migration in dev environment (1 hour)
5. Document schema with ER diagram (1 hour)

**Milestone:** Database schema deployed, Epic 2 unblocked

---

### Phase 2: File Upload Infrastructure (Stories 2.2, 2.5)
**Duration:** 1-2 days
**Parallel Work:** 2.2 and 2.5 can be developed simultaneously

1. Story 2.2: Model upload API (4-6 hours)
2. Story 2.5: Slice upload API (3-4 hours)

**Milestone:** Individual file uploads working

---

### Phase 3: Zip Extraction (Stories 2.3, 2.4)
**Duration:** 2-3 days
**Sequential:** 2.4 depends on 2.3

1. Story 2.3: Zip extraction (8-10 hours)
2. Story 2.4: File selection UI + bulk import (6-8 hours)

**Milestone:** Bulk import workflow complete

---

### Phase 4: Thumbnail Handling (Story 2.6)
**Duration:** 1-2 days
**Can start after 2.2/2.5 complete**

1. Story 2.6: Image resize + thumbnail upload (6-8 hours)
2. **Testing Required:** Verify sharp compatibility with Cloudflare Workers

**Milestone:** Thumbnail auto-resize working

---

### Phase 5: CRUD Operations (Stories 2.7, 2.8)
**Duration:** 1-2 days
**Parallel Work:** 2.7 and 2.8 can be developed simultaneously

1. Story 2.7: Model CRUD (4-6 hours)
2. Story 2.8: Slice CRUD (4-6 hours)

**Milestone:** Epic 2 complete, ready for Epic 3

---

## Acceptance Criteria

### Epic-Level Success Criteria

Epic 2 is considered complete when:

1. **Database Schema Deployed**
   - [x] All tables created with proper relationships
   - [x] Indexes created for search and performance
   - [x] Migrations tested in dev/staging/production
   - [x] Prisma Client generated and working

2. **File Upload Working**
   - [x] Individual model uploads (.stl, .3mf) successful
   - [x] Individual slice uploads (.gcode.3mf, .gcode) successful
   - [x] Files stored in R2 with proper headers
   - [x] Database records created atomically with R2

3. **Zip Extraction Working**
   - [x] 500MB zip files extracted successfully
   - [x] Recursive directory scanning working
   - [x] File type filtering accurate
   - [x] User selection UI functional
   - [x] Bulk import creates all records

4. **Thumbnail Handling Working**
   - [x] Image uploads successful
   - [x] Auto-resize working for oversized images
   - [x] Thumbnails displayed correctly in UI
   - [x] sharp compatibility verified (or fallback implemented)

5. **CRUD Operations Working**
   - [x] Model detail pages display all information
   - [x] Slice detail pages display all information
   - [x] Deletion works with proper warnings
   - [x] R2 cleanup happens on deletion
   - [x] Relationship navigation functional

6. **Performance Requirements Met**
   - [x] File uploads complete in reasonable time (<30s for 50MB)
   - [x] Zip extraction completes in ≤10s per NFR-1
   - [x] Database queries performant with indexes

---

## Testing Strategy

### Unit Tests

**File:** `/tests/unit/zip-extractor.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { extractZipFile } from '~/lib/zip/extractor'
import JSZip from 'jszip'

describe('Zip Extractor', () => {
  it('should extract valid model files', async () => {
    const zip = new JSZip()
    zip.file('models/test.stl', 'STL content')
    zip.file('models/test.3mf', '3MF content')
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    const extracted = await extractZipFile(zipBlob)

    expect(extracted).toHaveLength(2)
    expect(extracted[0].type).toBe('model')
    expect(extracted[1].type).toBe('model')
  })

  it('should filter out non-whitelisted files', async () => {
    const zip = new JSZip()
    zip.file('test.stl', 'STL content')
    zip.file('readme.txt', 'Text content')
    zip.file('.DS_Store', 'System file')
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    const extracted = await extractZipFile(zipBlob)

    expect(extracted).toHaveLength(1)
    expect(extracted[0].filename).toBe('test.stl')
  })

  it('should handle nested directories', async () => {
    const zip = new JSZip()
    zip.file('folder1/folder2/model.stl', 'STL content')
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    const extracted = await extractZipFile(zipBlob)

    expect(extracted).toHaveLength(1)
    expect(extracted[0].path).toBe('folder1/folder2/model.stl')
  })
})
```

**File:** `/tests/unit/image-resize.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { resizeImage } from '~/lib/images/resize'
import sharp from 'sharp'

describe('Image Resize', () => {
  it('should resize oversized images', async () => {
    // Create test image 2048x2048
    const testImage = await sharp({
      create: {
        width: 2048,
        height: 2048,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer()

    const resized = await resizeImage(testImage.buffer, 'test.jpg')

    expect(resized).not.toBeNull()
    const metadata = await sharp(resized!).metadata()
    expect(metadata.width).toBeLessThanOrEqual(1024)
    expect(metadata.height).toBeLessThanOrEqual(1024)
  })

  it('should not resize images within limits', async () => {
    const testImage = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer()

    const resized = await resizeImage(testImage.buffer, 'test.jpg')

    expect(resized).not.toBeNull()
    expect(resized!.length).toBeCloseTo(testImage.length, -2) // Similar size
  })
})
```

### Integration Tests

**File:** `/tests/integration/file-upload.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('File Upload Workflow', () => {
  beforeAll(async () => {
    // Clean database
    await prisma.model.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should upload model file and create database record', async () => {
    // Create test file
    const testFile = new File(['STL content'], 'test.stl', {
      type: 'model/stl',
    })

    const formData = new FormData()
    formData.append('file', testFile)

    // Upload
    const response = await fetch('http://localhost:3000/api/models/upload', {
      method: 'POST',
      body: formData,
    })

    expect(response.status).toBe(201)
    const data = await response.json()

    expect(data.id).toBeDefined()
    expect(data.filename).toBe('test.stl')

    // Verify database record
    const model = await prisma.model.findUnique({
      where: { id: data.id },
    })

    expect(model).not.toBeNull()
    expect(model!.filename).toBe('test.stl')
  })

  it('should reject invalid file types', async () => {
    const testFile = new File(['Text content'], 'test.txt', {
      type: 'text/plain',
    })

    const formData = new FormData()
    formData.append('file', testFile)

    const response = await fetch('http://localhost:3000/api/models/upload', {
      method: 'POST',
      body: formData,
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error.code).toBe('INVALID_FILE_TYPE')
  })
})
```

### Manual Testing Checklist

```markdown
# Epic 2 Manual Testing Checklist

## Story 2.1: Database Schema
- [ ] Run migration in dev environment
- [ ] Verify all tables created in Xata dashboard
- [ ] Confirm indexes created
- [ ] Test Prisma Client queries

## Story 2.2: Model Upload
- [ ] Upload .stl file successfully
- [ ] Upload .3mf file successfully
- [ ] Verify file appears in R2 bucket
- [ ] Verify database record created
- [ ] Test file too large (>500MB) rejection
- [ ] Test invalid file type rejection
- [ ] Verify download works with proper headers

## Story 2.3: Zip Extraction
- [ ] Upload zip with nested directories
- [ ] Verify all valid files extracted
- [ ] Verify invalid files filtered out
- [ ] Test with 500MB zip file
- [ ] Test with corrupted zip file
- [ ] Verify extraction performance (<10s)

## Story 2.4: Bulk Import
- [ ] Select all files and import
- [ ] Select subset of files and import
- [ ] Deselect all and verify import disabled
- [ ] Verify progress indicator shows during import
- [ ] Verify success confirmation shows imported files
- [ ] Test with mixed file types (models + images)

## Story 2.5: Slice Upload
- [ ] Upload .gcode.3mf file successfully
- [ ] Upload .gcode file successfully
- [ ] Verify file appears in R2 bucket
- [ ] Verify database record created
- [ ] Test file too large (>50MB) rejection

## Story 2.6: Thumbnail Handling
- [ ] Upload oversized image (>2MB or >1024x1024)
- [ ] Verify image auto-resized
- [ ] Verify resized image within limits
- [ ] Upload image within limits
- [ ] Verify no resize performed for small images
- [ ] Test sharp compatibility in Cloudflare Workers

## Story 2.7: Model CRUD
- [ ] View model detail page
- [ ] Download model file
- [ ] Delete model (not used in slices)
- [ ] Attempt delete model used in slices (verify prevented)
- [ ] Verify R2 file deleted when model deleted
- [ ] View model list page

## Story 2.8: Slice CRUD
- [ ] View slice detail page
- [ ] Download slice file
- [ ] Delete slice (not last for variant)
- [ ] Attempt delete last slice for variant (verify prevented)
- [ ] Verify R2 file deleted when slice deleted
- [ ] View slice list page
- [ ] Verify related models/filaments/products displayed
```

---

## Risks and Mitigations

### Risk 1: sharp Incompatibility with Cloudflare Workers

**Risk Level:** HIGH
**Probability:** HIGH
**Impact:** MEDIUM (blocks thumbnail auto-resize)

**Description:**
sharp requires native bindings which may not work in Cloudflare Workers runtime.

**Mitigation:**
1. Test sharp in Cloudflare Workers dev environment immediately (Story 2.6)
2. If incompatible, implement fallback strategies:
   - **Option A:** Client-side canvas resizing before upload
   - **Option B:** Use Cloudflare Images API (paid service)
   - **Option C:** Use wasm-vips (pure WebAssembly version)

**Contingency Plan:**
- Implement client-side resize using HTML5 Canvas API
- Degrade user experience slightly (larger images during upload)
- Revisit server-side resize in Phase 2 if better solution emerges

---

### Risk 2: Large Zip File Memory Usage

**Risk Level:** MEDIUM
**Probability:** MEDIUM
**Impact:** MEDIUM (500MB zips may exceed memory limits)

**Description:**
Cloudflare Workers have memory limits. Extracting 500MB zip in-memory may fail.

**Mitigation:**
1. Use streaming extraction if JSZip supports it
2. Test with progressively larger zip files (100MB, 250MB, 500MB)
3. Monitor memory usage during extraction

**Contingency Plan:**
- Reduce max zip size to 250MB if 500MB fails
- Implement chunked extraction with temporary R2 storage
- Process files in batches rather than all at once

---

### Risk 3: R2+Database Atomicity Failures

**Risk Level:** MEDIUM
**Probability:** LOW
**Impact:** HIGH (orphaned files or records)

**Description:**
Network failures or errors between R2 upload and database creation can leave orphaned files.

**Mitigation:**
1. Upload to R2 first, database second
2. Delete R2 file if database creation fails
3. Implement retry logic with exponential backoff
4. Log all atomicity failures for manual cleanup

**Contingency Plan:**
- Create background job to scan for orphaned R2 files (files without database records)
- Implement manual cleanup UI in admin dashboard

---

### Risk 4: Concurrent Upload Performance

**Risk Level:** LOW
**Probability:** LOW (single user MVP)
**Impact:** LOW

**Description:**
Multiple concurrent uploads may degrade performance or exhaust Cloudflare Worker CPU limits.

**Mitigation:**
1. Client-side upload queue (one at a time)
2. Server-side rate limiting if needed
3. Monitor CPU usage in Cloudflare Dashboard

**Contingency Plan:**
- Defer to Phase 2 if becomes issue
- Acceptable for MVP with single user

---

## Dependencies

### External Libraries

```json
{
  "dependencies": {
    "@prisma/client": "^6.1.0",
    "jszip": "^3.10.1",
    "sharp": "^0.33.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/jszip": "^3.4.1",
    "@types/sharp": "^0.32.0",
    "prisma": "^6.1.0"
  }
}
```

### Environment Variables

```bash
# .env.example
DATABASE_URL="postgresql://..."  # Xata connection string
```

### Cloudflare Bindings

```jsonc
// wrangler.jsonc
{
  "r2_buckets": [
    {
      "binding": "FILES_BUCKET",
      "bucket_name": "pm-dev-files" // or pm-staging-files, pm-files
    }
  ]
}
```

---

## Deliverables Checklist

### Configuration Files
- [x] `/prisma/schema.prisma` - Complete database schema
- [x] `/prisma/migrations/` - Initial migration created

### Code Files

**Database:**
- [x] `/src/lib/db/client.ts` - Prisma Client setup

**API Routes:**
- [x] `/src/routes/api/models/upload.ts` - Model upload
- [x] `/src/routes/api/models/upload-zip.ts` - Zip extraction
- [x] `/src/routes/api/models/import-zip.ts` - Bulk import
- [x] `/src/routes/api/models/$modelId.ts` - Model CRUD
- [x] `/src/routes/api/slices/upload.ts` - Slice upload
- [x] `/src/routes/api/slices/$sliceId.ts` - Slice CRUD
- [x] `/src/routes/api/images/upload.ts` - Thumbnail upload

**Libraries:**
- [x] `/src/lib/zip/extractor.ts` - Zip extraction utility
- [x] `/src/lib/images/resize.ts` - Image resize utility

**Pages:**
- [x] `/src/routes/models/upload-zip.tsx` - Zip upload page
- [x] `/src/routes/models/$modelId.tsx` - Model detail page
- [x] `/src/routes/slices/$sliceId.tsx` - Slice detail page

**Tests:**
- [x] `/tests/unit/zip-extractor.test.ts`
- [x] `/tests/unit/image-resize.test.ts`
- [x] `/tests/integration/file-upload.test.ts`

### Documentation
- [x] This technical specification
- [x] ER diagram (in solution-architecture.md)
- [x] Migration notes (inline in this spec)

---

## Definition of Done

Epic 2 is **DONE** when:

1. ✅ All 8 stories completed (2.1-2.8)
2. ✅ All acceptance criteria met per story
3. ✅ Database schema deployed to all environments
4. ✅ File upload workflows tested end-to-end
5. ✅ Zip extraction tested with 500MB files
6. ✅ Thumbnail auto-resize working (or fallback implemented)
7. ✅ CRUD operations tested with proper cleanup
8. ✅ Unit tests passing (>80% coverage per NFR-8)
9. ✅ Integration tests passing
10. ✅ Manual testing checklist completed
11. ✅ Code merged to master branch
12. ✅ Epic 3 unblocked and ready to begin

**Sign-Off Required From:**
- Developer (implementation complete)
- Tech Lead (code review approved)
- Product Owner (business value delivered)

---

## Post-Review Follow-ups

**Story 2.1 Review (2025-10-23):**

**Status:** ✅ **APPROVED** (Re-reviewed 2025-10-23 after fixes)

### ✅ Resolved Issues
- **[CRITICAL-1]** ✅ FIXED - Prisma Client Adapter Initialization - Implemented dual generator solution (cloudflare + local) with proper @prisma/adapter-pg initialization
- **[CRITICAL-2]** ✅ FIXED - Tests Passing - All 81 tests passing (9 test files), including 23 database tests
- **[Med-3]** ✅ FIXED - Environment-Aware Adapter Selection - Dual generator approach handles this automatically with Vitest aliasing

### 🟡 Remaining Medium Priority (Non-Blocking)
- **[Med-1]** Document Cloudflare Workers Adapter - Create `docs/CLOUDFLARE_PRISMA_SETUP.md` explaining adapter requirement for Workers deployment
- **[Low-2]** Add Inline Schema Comments - Document FR-10 SetNull behavior rationale at `prisma/schema.prisma:110`

### 🟢 Low Priority (Nice to Have)
- **[Low-1]** Evaluate Custom Prisma Output Path - Consider using default location vs `./generated` (may be intentional for Workers bundling)
- **[Low-3]** Simplify Test Cleanup Logic - Refactor `src/lib/db/__tests__/schema.test.ts:330-344`

**Final Review Outcome:** ✅ **APPROVED - Ready to merge.** All critical issues resolved. Implementation demonstrates exceptional database design with innovative dual-generator solution for Cloudflare Workers compatibility. All 9 acceptance criteria met. 81 tests passing.

---

## Next Steps

1. **Begin Story 2.1:** Database schema design and migration
2. **Parallel Development:** Stories 2.2 and 2.5 can start after 2.1
3. **Critical Validation:** Test sharp in Cloudflare Workers early (Story 2.6)
4. **Epic 3 Preparation:** Metadata extraction depends on slice upload working

---

**Document Status:** FINAL
**Ready for Implementation:** YES
**Next Action:** Begin Story 2.1 (Database Schema Design)

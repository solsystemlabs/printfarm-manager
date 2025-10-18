# PrintFarm Manager Solution Architecture

**Project:** printfarm-manager
**Author:** Taylor
**Date:** 2025-10-15
**Project Level:** 3
**Architecture Status:** In Progress

---

## Prerequisites and Scale Assessment

**✅ Prerequisites Validated**

**Check 1: PRD Complete?**
- Status: ✅ COMPLETE
- PRD fully documented with 18 FRs, 12 NFRs, 5 epics (~30-35 stories)
- Document status: "PRD Complete and Ready for Handoff"

**Check 2: UX Spec Complete (UI project)?**
- Status: ✅ COMPLETE
- UX specification exists at `/docs/ux-specification.md`
- Comprehensive specification including information architecture, user flows, component library, and wireframes

**Check 3: All prerequisites met?**
- Status: ✅ READY TO PROCEED
- PRD: complete
- UX Spec: complete
- Proceeding with solution architecture workflow...

**Project Classification:**
- **Project Level**: 3 (from PRD)
- **Field Type**: Hybrid (infrastructure setup complete, application code greenfield)
  - ✅ Existing: TanStack Start project structure, Cloudflare deployment configuration
  - 🆕 Greenfield: All application code (routes, components, database schema, business logic)
  - Note: Existing app code will be replaced - only infrastructure/deployment config retained
- **Project Type**: Web (TanStack Start application)
- **Has User Interface**: Yes
- **UI Complexity**: Moderate (grid browsing, wizards, file uploads, recipe cards, metadata extraction workflows)

**Workflow Path Determination:**
- Project level = 3 → Full solution architecture workflow required
- Proceeding with all architecture steps...

---

## PRD and UX Analysis

### Project Understanding

**PrintFarm Manager** is a web-based recipe repository system that transforms 3D print farm operations from manual, owner-dependent workflows into systematic, reproducible manufacturing processes.

**Core Business Problem:**
The print farm business has reached an inflection point where manual workflows block growth. Current pain points:
- Hours wasted reslicing the same models repeatedly (lost gcode files)
- Assistants unable to work independently (missing configuration information)
- Files scattered across folders - can't find original slices
- Critical information (filament AMS slot assignments, slicer settings) exists only in owner's memory

**Solution Approach:**
Automatic metadata extraction from Bambu Lab `.gcode.3mf` files creates permanent "recipes" that capture exact configuration needed to reproduce any product. This automation transforms assistants from dependent workers into autonomous operators who can independently execute production using simple recipe cards.

**Architecture Centerpiece:**
Product-centric architecture where physical inventory items are first-class entities served by digital files (models and slices), naturally supporting business operations rather than just hobby file storage.

### Requirements Summary

**Functional Requirements: 18 FRs organized by workflow**
1. **Uploading and Organizing** (FR-1 to FR-3, FR-13): Model/slice uploads, zip extraction, thumbnails, file validation
2. **Slicing and Configuration** (FR-4 to FR-6, FR-14): Metadata extraction, filament matching, AMS slot tracking
3. **Creating Products** (FR-7, FR-9, FR-10, FR-15): Product/variant management, multi-model slices, streamlined workflows
4. **Finding and Using** (FR-8, FR-11, FR-12, FR-18): Recipe cards, fuzzy search, relationship navigation, curated metadata
5. **Managing Data** (FR-16, FR-17): Downloads, hard deletion with warnings

**Non-Functional Requirements: 12 NFRs**
- NFR-1: Performance (≤2s page loads, ≤1s search, ≤10s file processing)
- NFR-2: File Sizes (500MB zip, 50MB slices, 2MB images with auto-resize)
- NFR-3: Reliability (99% uptime, cold start handling)
- NFR-4: Data Integrity (atomic R2+DB operations, referential integrity)
- NFR-5: Usability (desktop-optimized workflows, mobile recipe cards, React Aria Components)
- NFR-6: Error Handling (descriptive messages, retry logic, fallbacks)
- NFR-7: Security (no authentication in MVP, UUID-based recipe URLs, input sanitization)
- NFR-8: Maintainability (TypeScript strict, >80% test coverage, Zod validation)
- NFR-9: Observability (comprehensive logging, performance metrics, 100% head sampling)
- NFR-10: Deployment (3 environments, Cloudflare Workers Builds, ≤5min deployments)
- NFR-11: Scalability (1000+ products without degradation, tenant_id columns for future SaaS)
- NFR-12: Backup (Xata daily backups, R2 versioning)

### Epic Structure (5 Epics, ~32 Stories)

**Epic 1: Deployment & Operations Foundation** (6 stories, CRITICAL)
- Establish 3 environments (dev/staging/production) with Cloudflare Workers Builds
- Configure Xata database branching and R2 buckets per environment
- Implement logging, monitoring, observability (100% head sampling)
- Storage usage visibility dashboard
- **Rationale**: Infrastructure foundation required before feature development

**Epic 2: Core File Management** (7-9 stories, HIGH)
- Database schema design (Prisma/Xata with multi-tenant support)
- Model/slice file uploads with R2 storage
- Zip extraction with recursive directory scanning
- File selection UI for bulk imports
- Thumbnail handling with auto-resize
- CRUD operations for models and slices
- **Rationale**: File storage foundation for metadata extraction and products

**Epic 3: Metadata Extraction & Filament Matching** (6-8 stories, HIGH)
- Parse Bambu Lab `.gcode.3mf` files (JSON in `Metadata/project_settings.config`)
- Zod schema validation with type coercion
- Smart filament matching (brand normalization, hex color matching)
- Inline filament creation during wizard
- AMS slot tracking
- Curated vs. complete metadata display
- **Rationale**: Automation is core value proposition - eliminates manual data entry

**Epic 4: Product & Recipe System** (8-10 stories, HIGH)
- Product and variant entities with many-to-many slice relationships
- Slice upload wizard with metadata pre-population
- Multi-model slice support (many-to-many models-to-slices)
- Recipe card generation with UUID-based URLs
- Product creation wizard integrating all workflows
- "Needs slicing" tracking
- Relationship navigation UI
- **Rationale**: Recipe cards enable assistant autonomy - primary business goal

**Epic 5: Search & Discovery** (5-7 stories, MEDIUM)
- Fuzzy search with typo tolerance (third-party solution or Levenshtein)
- Visual grid browsing with large thumbnails
- Landing page optimized for assistant workflow
- Basic filtering (file type, material type, product name)
- Download operations with proper headers
- **Rationale**: Efficient catalog navigation as inventory grows to 1000+ products

### UI/UX Summary

**Screen Count**: ~12-15 primary screens/views
- Landing page (product catalog grid)
- Product list/detail, variant management
- Model list/detail, upload workflows
- Slice list/detail, wizard
- Filament management
- Recipe card (public, mobile-optimized)
- Admin/storage dashboard
- Needs slicing list

**Navigation Complexity**: Moderate
- Visual-first grid navigation with thumbnails (200x200px minimum)
- Always-visible search bar for fuzzy search
- Relationship-based navigation (filament → slices → products)
- Breadcrumbs for deep navigation paths

**UI Complexity**: Moderate
- **Complex Workflows**: Multi-step wizard (slice upload → metadata extraction → filament matching → product creation)
- **Drag-and-Drop**: File uploads with bulk selection
- **Real-time Feedback**: Upload progress, inline validation, toast notifications
- **Progressive Disclosure**: Curated metadata by default, "Show All" toggle for complete JSON
- **Responsive Grids**: 4 columns desktop → 2 tablet → 1 mobile

**Key User Flows**:
1. **Owner**: Upload zip → extract models → download for slicing → upload slice → auto-extract metadata → create/link products → share recipe URL
2. **Assistant**: Search product → view recipe card → download slice → load filaments per AMS slots → start print
3. **Owner**: Add variant → slice with different filament → upload → match/create filament → link to existing product

**Component Patterns** (from UX spec):
- React Aria Components (accessibility baseline)
- Grid/card layouts with lazy-loaded images
- Multi-step wizard component
- File upload dropzone with progress
- Toast notification system
- Modal/dialog for confirmations
- Inline editing for metadata
- JSON tree viewer for advanced metadata

**Responsive Requirements**:
- Mobile-first CSS breakpoints
- Desktop-optimized: File uploads, catalog management, multi-step wizards
- Mobile-optimized: Recipe cards (large touch targets, readable at printer, easy downloads)
- Touch-friendly: 44px minimum tap targets throughout

**Performance Requirements**:
- ≤2s page loads (lazy load images, code splitting)
- ≤1s search results (indexed queries)
- Skeleton loaders during data fetch
- Optimistic UI updates where safe

### PRD-UX Alignment Check

✅ **All epics have corresponding UX flows**:
- Epic 1 → Logging and observability (dashboard, storage monitoring)
- Epic 2 → Upload workflows (zip extraction, file selection)
- Epic 3 → Metadata wizard (filament matching, curated display)
- Epic 4 → Product/variant management, recipe cards
- Epic 5 → Search bar, grid browsing, landing page

✅ **All user journeys supported**:
- Journey 1 (First-Time Product Setup) → Epics 2-4 workflows
- Journey 2 (Autonomous Reprint) → Epic 5 search + Epic 4 recipe cards
- Journey 3 (New Variant Addition) → Epic 3 filament matching + Epic 4 variants

✅ **No gaps identified** - UX spec comprehensively covers all functional requirements with detailed wireframes and component specifications

### Technology Stack (Identified from PRD/CLAUDE.md)

**Already Established**:
- Frontend: React 19, TanStack Router, TanStack Query (React Query)
- Build: Vite, TypeScript (strict mode)
- Deployment: Cloudflare Workers, Wrangler
- Storage: Cloudflare R2
- Database: Xata (Postgres-compatible with automatic branching)
- Styling: TailwindCSS with tailwind-merge
- Testing: Vitest with React Testing Library
- Linting: ESLint v9, Prettier

**To Be Determined**:
- API Layer: tRPC (end-to-end type safety) vs TanStack Start server functions vs plain fetch
- Image resizing library (sharp vs canvas vs cloudflare-images)
- Zip extraction library (JSZip confirmed in technical notes)
- Component library for wizards/modals (React Aria Components mentioned in UX spec)
- Fuzzy search implementation (third-party vs Levenshtein)
- JSON viewer for metadata display

**To Be Removed**:
- redaxios (currently in package.json but not needed - will use TanStack Start server functions + fetch)

---

## Architecture Pattern

### Selected Architecture Template

Based on the project requirements analysis:
- **Project Type**: Web application (TanStack Start)
- **Languages**: TypeScript
- **Architecture Style**: Serverless monolith
- **Repository Strategy**: Monorepo
- **Deployment**: Cloudflare Workers (edge compute)

**Selected Template**: Custom TanStack Start + Cloudflare Workers architecture (closest match: `web-cloudflare-workers` from registry)

**Rationale**: This is a full-stack serverless application using TanStack Start's file-based routing, deployed to Cloudflare Workers with R2 storage and Xata database. The architecture combines:
- SSR capabilities for optimal performance
- Edge deployment for global low-latency access
- Zero-cost serverless infrastructure (Cloudflare free tier)
- Type-safe full-stack development with TypeScript

### Architecture Style: Serverless Monolith

**Pattern**: Single application deployed as Cloudflare Worker with file-based routing

**Characteristics**:
- **Frontend + Backend Colocation**: TanStack Start provides SSR, client-side React, and API routes in single codebase
- **File-Based API Routes**: `src/routes/api/**/*.ts` define server-side handlers executed in Cloudflare Workers runtime
- **Edge Deployment**: Code runs on Cloudflare's global edge network (Smart Placement optimizes execution location)
- **Stateless Compute**: Workers are ephemeral; all state in Xata (database) and R2 (files)

**Why Monolith vs Microservices**:
- ✅ Single deployment simplifies operations (no service orchestration)
- ✅ Zero network latency between "services" (all in same Worker)
- ✅ Shared TypeScript types across frontend/backend eliminate API drift
- ✅ Simpler debugging and observability (single log stream)
- ✅ MVP scope (5 epics, ~32 stories) doesn't warrant microservices complexity
- ⚠️ Future consideration: If system grows beyond 1000+ products and requires separate scaling for file processing vs search, evaluate extracting heavy operations to separate Workers

**Why Serverless vs Traditional Server**:
- ✅ Zero infrastructure management (Cloudflare handles scaling, availability)
- ✅ Pay-per-use (free tier covers MVP, automatic scaling if usage grows)
- ✅ Global edge deployment (low latency for owner working remotely)
- ✅ Automatic cold start handling (NFR-3 accepts 1-2s initial delay)
- ⚠️ Constraint: CPU execution time limits (Cloudflare Workers free tier: 10ms CPU/request, paid: 50ms) - metadata extraction must be efficient

### Repository Strategy: Monorepo

**Pattern**: Single git repository containing all application code

**Structure**:
```
printfarm-manager/
├── src/
│   ├── routes/           # File-based routing (pages + API)
│   ├── components/       # Shared React components
│   ├── lib/              # Shared utilities, types, schemas
│   └── styles/           # Global CSS, Tailwind config
├── docs/                 # Architecture, PRD, UX spec
├── tests/                # Vitest tests
└── wrangler.jsonc        # Cloudflare Workers config
```

**Why Monorepo**:
- ✅ Single codebase aligns with monolith architecture
- ✅ Shared TypeScript types/schemas between frontend/backend (Zod schemas, database models)
- ✅ Simplified dependency management (single package.json, lock file)
- ✅ Atomic commits across frontend/backend changes
- ✅ No cross-repo coordination for deployments

### Project-Specific Characteristics

**Web Application Type**: Full-stack SSR with API routes

**SSR vs SPA**:
- **Hybrid SSR + Client Hydration**: TanStack Start renders initial HTML server-side, hydrates to interactive React client-side
- **Why SSR**: Faster initial page loads (≤2s per NFR-1), better for assistant on mobile at printer
- **Why Client Hydration**: Rich interactions (file upload progress, wizards, search-as-you-type) require JavaScript

**API Strategy**: TanStack Start Server Functions

**Decision**: Use TanStack Start's built-in server functions over tRPC

**Rationale**:
- ✅ File-based routing already established (`src/routes/api/` pattern)
- ✅ Built-in TypeScript inference (no additional setup)
- ✅ Cleaner integration with TanStack Router/Query (same mental model)
- ✅ Simpler for intermediate developers (less abstraction than tRPC)
- ✅ Example in CLAUDE.md shows `server.handlers` pattern already working
- ⚠️ Trade-off: Less procedural than tRPC, but sufficient for this use case

**Server Function Pattern**:
```typescript
// src/routes/api/models/upload.ts
export const Route = createFileRoute('/api/models/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Access Cloudflare context
        const cf = getContext('cloudflare')
        const bucket = cf.env.MY_BUCKET

        // Handle file upload
        const formData = await request.formData()
        // ... upload logic

        return json({ success: true, modelId: '...' })
      }
    }
  }
})
```

**Client Data Fetching**: TanStack Query

**Pattern**: Use loaders for SSR data, mutations for actions

```typescript
// SSR data fetching
const queryOptions = queryOptions({
  queryKey: ['products'],
  queryFn: () => fetch('/api/products').then(r => r.json())
})

// Client-side mutations
const uploadMutation = useMutation({
  mutationFn: (formData: FormData) =>
    fetch('/api/models/upload', { method: 'POST', body: formData })
})
```

**Offline Support**: Not required for MVP (all operations require server/database access)

---

## Epic Analysis and Component Boundaries

### Component Architecture

Based on epic analysis, the system decomposes into the following logical components:

#### 1. Infrastructure & Deployment (Epic 1)

**Responsibilities**:
- Environment management (dev/staging/production)
- CI/CD pipeline (Cloudflare Workers Builds)
- Logging and observability
- Configuration management

**Components**:
- **Environment Configuration**: `wrangler.jsonc` with environment-specific settings
- **Database Branching**: Xata branch-per-environment (dev/staging/production + PR previews)
- **Storage Buckets**: R2 buckets per environment (`pm-dev-files`, `pm-staging-files`, `pm-files`)
- **Observability Layer**: Structured logging, performance metrics, storage monitoring

**Epic Mapping**: Epic 1 (Stories 1.1-1.7)

---

#### 2. File Storage & Management (Epic 2)

**Responsibilities**:
- File upload handling (models, slices, images)
- Zip extraction and processing
- R2 storage operations
- Thumbnail management
- File metadata tracking

**Components**:
- **Upload Service**: Handles multipart form data, validates file types/sizes
- **Zip Processor**: Extracts and scans zip contents (JSZip library)
- **R2 Storage Client**: Wrapper for R2 operations with proper headers
- **Thumbnail Service**: Image resizing and optimization
- **File Registry**: Database records linking files to entities

**Key Operations**:
- Upload individual model/slice files → R2 + database record
- Upload zip → extract → present selection → batch import to R2
- Download files with forced content-disposition headers
- Delete files (R2 + database atomically)

**Data Models**:
```typescript
// Core file entities
Model {
  id: UUID
  tenant_id?: UUID // nullable in MVP
  filename: string
  r2_key: string
  r2_url: string
  file_size: number
  content_type: string
  thumbnail_url?: string
  created_at: timestamp
  updated_at: timestamp
}

Slice {
  id: UUID
  tenant_id?: UUID
  filename: string
  r2_key: string
  r2_url: string
  file_size: number
  content_type: string
  thumbnail_url?: string
  metadata_extracted: boolean
  metadata_json?: JSON // complete extracted metadata
  created_at: timestamp
  updated_at: timestamp
}
```

**Epic Mapping**: Epic 2 (Stories 2.1-2.8)

**Integration Points**:
- → R2 (file storage)
- → Xata (file metadata)
- → Metadata Extraction (Epic 3, triggered after slice upload)

---

#### 3. Metadata Extraction & Filament Matching (Epic 3)

**Responsibilities**:
- Parse Bambu Lab `.gcode.3mf` files
- Extract and validate metadata with Zod schemas
- Match filaments to existing database records
- Inline filament creation during wizard
- AMS slot tracking

**Components**:
- **Metadata Parser**: Unzip `.gcode.3mf`, read `Metadata/project_settings.config`, parse JSON
- **Metadata Validator**: Zod schemas for type safety and coercion
- **Filament Matcher**: Smart matching algorithm (brand normalization, hex color, material/type)
- **Extraction Wizard**: Multi-step UI flow with pre-populated forms

**Key Operations**:
- Extract metadata synchronously during upload (blocking per FR-2)
- Validate and coerce types (e.g., string "220" → number 220)
- Search for matching filament: normalize brand, exact hex match, material+type match
- Create new filament if no match (inline, preserves wizard flow)
- Display curated metadata vs complete JSON toggle

**Data Models**:
```typescript
Filament {
  id: UUID
  tenant_id?: UUID
  brand: string
  color_hex: string // e.g., "#FF5733"
  color_name?: string // e.g., "Red"
  material_type: string // PLA, PETG, ABS, TPU
  filament_type: string // Basic, Matte, Silk, Sparkle
  created_at: timestamp
  updated_at: timestamp
  // Unique constraint: (brand, color_hex, material_type, filament_type)
}

SliceFilament {
  id: UUID
  slice_id: UUID → Slice
  filament_id: UUID → Filament
  ams_slot_index: number // 1-based, non-contiguous OK
  created_at: timestamp
}
```

**Metadata Schema (Zod)**:
```typescript
const SliceMetadataSchema = z.object({
  layer_height: z.coerce.number(),
  nozzle_temperature: z.coerce.number(),
  bed_temperature: z.coerce.number(),
  print_speed: z.coerce.number(),
  infill_percentage: z.coerce.number(),
  supports_enabled: z.boolean(),
  estimated_time_seconds: z.coerce.number(),
  filament_used_g: z.coerce.number(),
  filaments: z.array(z.object({
    brand: z.string(),
    color: z.string(), // hex
    material_type: z.string(),
    filament_type: z.string(),
    ams_slot_index: z.number(),
  })),
  // ... additional fields as discovered during implementation
})
```

**Epic Mapping**: Epic 3 (Stories 3.1-3.7)

**Integration Points**:
- ← File Storage (receives uploaded slice file)
- → Product System (metadata feeds into product/variant creation)
- → Database (filament CRUD)

---

#### 4. Product & Recipe System (Epic 4)

**Responsibilities**:
- Product and variant management
- Many-to-many slice-variant relationships
- Multi-model slice support
- Recipe card generation
- Wizard orchestration (slice → product)

**Components**:
- **Product Service**: CRUD for products and variants
- **Relationship Manager**: Many-to-many associations (slices↔models, slices↔variants)
- **Recipe Generator**: Compose recipe cards with curated metadata
- **Wizard Orchestrator**: Multi-step flow integrating file upload, extraction, matching, product creation

**Key Operations**:
- Create product with variants
- Link slices to variants (with quantity-per-print)
- Link models to slices (multi-model plates)
- Generate recipe card: product + variant + slice + filaments + metadata
- Public recipe URL: `/recipe/:uuid` (variant UUID or dedicated recipe UUID)

**Data Models**:
```typescript
Product {
  id: UUID
  tenant_id?: UUID
  name: string // unique
  description?: string
  thumbnail_url?: string
  created_at: timestamp
  updated_at: timestamp
}

ProductVariant {
  id: UUID
  product_id: UUID → Product
  tenant_id?: UUID
  name: string // unique within product
  thumbnail_url?: string
  created_at: timestamp
  updated_at: timestamp
  // Unique constraint: (product_id, name)
}

SliceVariant {
  id: UUID
  slice_id: UUID → Slice
  variant_id: UUID → ProductVariant
  quantity_per_print: number
  created_at: timestamp
}

SliceModel {
  id: UUID
  slice_id: UUID → Slice
  model_id: UUID → Model
  created_at: timestamp
}
```

**Recipe Card Structure**:
```typescript
interface RecipeCard {
  product: {
    name: string
    thumbnail_url: string
  }
  variant: {
    name: string
    quantity_per_print: number
  }
  slice: {
    filename: string
    download_url: string // R2 presigned URL
    estimated_time_hours: number
  }
  filaments: Array<{
    ams_slot: number
    brand: string
    color_name: string
    color_hex: string
    material_type: string
  }>
  settings: {
    layer_height_mm: number
    nozzle_temp_c: number
    bed_temp_c: number
    infill_percent: number
    supports: boolean
  }
}
```

**Epic Mapping**: Epic 4 (Stories 4.1-4.8)

**Integration Points**:
- ← Metadata Extraction (receives filament matches, metadata)
- ← File Storage (receives models, slices)
- → Search & Discovery (products indexed for search)

---

#### 5. Search & Discovery (Epic 5)

**Responsibilities**:
- Fuzzy search across product/model names
- Visual grid browsing
- Basic filtering
- Relationship navigation
- Landing page

**Components**:
- **Search Service**: Fuzzy text matching (evaluate: Xata full-text search vs Levenshtein distance)
- **Grid Renderer**: Lazy-loaded thumbnail grids with responsive layout
- **Filter Engine**: Simple filters (file type, material, product name)
- **Navigation Service**: Relationship traversal (filament → slices → products)

**Key Operations**:
- Search products/models with typo tolerance ("whle" finds "whale")
- Browse product catalog in grid view (4 cols desktop → 2 tablet → 1 mobile)
- Filter by material type (requires join: products → variants → slices → filaments)
- Navigate relationships: "Filament used in 12 slices" → click → list of slices

**Search Implementation Options**:
1. **Xata Full-Text Search** (if available): Leverage database-level indexing
2. **Third-Party Service** (Algolia, Typesense): Overkill for MVP, cost concerns
3. **Client-Side Fuzzy** (fuse.js): Limited by dataset size, not suitable for 1000+ products
4. **Custom Levenshtein**: Server-side implementation with indexed queries

**Recommendation**: Start with Xata full-text search (if available), fall back to simple ILIKE + optional Levenshtein for typo tolerance

**Epic Mapping**: Epic 5 (Stories 5.1-5.6)

**Integration Points**:
- ← All entities (products, models, slices, filaments)
- → UI layer (search bar, grid view, filters)

---

### Cross-Cutting Concerns

These span multiple epics and components:

#### Data Integrity & Atomicity (NFR-4)

**Pattern**: R2 first, database second, cleanup on failure

```typescript
// Upload operation
async function uploadModel(file: File) {
  // 1. Upload to R2
  const r2Key = `models/${uuid()}.stl`
  await r2Bucket.put(r2Key, file, {
    httpMetadata: {
      contentType: 'model/stl',
      contentDisposition: 'attachment'
    }
  })

  try {
    // 2. Create database record
    const model = await db.models.create({
      data: {
        filename: file.name,
        r2_key: r2Key,
        r2_url: `https://.../${r2Key}`,
        file_size: file.size,
        content_type: file.type
      }
    })
    return model
  } catch (error) {
    // 3. Cleanup R2 on DB failure
    await r2Bucket.delete(r2Key)
    throw error
  }
}

// Deletion operation
async function deleteModel(modelId: UUID) {
  const model = await db.models.findUnique({ where: { id: modelId }})

  // 1. Delete database record first
  await db.models.delete({ where: { id: modelId }})

  // 2. Queue R2 deletion after DB commit succeeds
  // (eventual consistency acceptable for storage cleanup)
  await r2Bucket.delete(model.r2_key)
}
```

#### Validation & Error Handling (NFR-6, NFR-8)

**Pattern**: Zod schemas shared client + server

```typescript
// src/lib/schemas/upload.ts
export const ModelUploadSchema = z.object({
  file: z.instanceof(File)
    .refine(f => f.size <= 500 * 1024 * 1024, "File too large (max 500MB)")
    .refine(f => ['.stl', '.3mf'].some(ext => f.name.endsWith(ext)),
      "Invalid file type (must be .stl or .3mf)")
})

// Server-side validation
const result = ModelUploadSchema.safeParse(formData)
if (!result.success) {
  return json({ error: result.error.format() }, { status: 400 })
}

// Client-side validation (same schema)
const { errors } = ModelUploadSchema.safeParse(selectedFile)
```

#### Logging & Observability (NFR-9)

**Pattern**: Structured logging at key points

```typescript
// Log all API operations
console.log(JSON.stringify({
  event: 'model_upload_start',
  filename: file.name,
  size: file.size,
  environment: cf.env.ENVIRONMENT,
  timestamp: new Date().toISOString()
}))

// Log performance metrics
const startTime = Date.now()
// ... operation ...
console.log(JSON.stringify({
  event: 'model_upload_complete',
  duration_ms: Date.now() - startTime,
  model_id: model.id
}))

// Log errors (never stack traces to users)
console.error(JSON.stringify({
  event: 'model_upload_error',
  error_message: error.message, // safe
  // stack: error.stack // NEVER log to user-facing response
}))
```

### Component Dependency Graph

```
┌─────────────────────────────────────────────────┐
│  Infrastructure & Deployment (Epic 1)           │
│  - Wrangler config                               │
│  - Environment management                        │
│  - Logging                                       │
└─────────────────────────────────────────────────┘
              ↓ provides runtime
┌─────────────────────────────────────────────────┐
│  Cross-Cutting Services                          │
│  - Validation (Zod)                              │
│  - Error Handling                                │
│  - Logging                                       │
│  - R2 Client                                     │
│  - Database Client (Xata/Prisma)                │
└─────────────────────────────────────────────────┘
         ↓ used by all components
┌─────────────────────────────────────────────────┐
│  File Storage (Epic 2)                           │
│  - Upload Service                                │
│  - Zip Processor                                 │
│  - Thumbnail Service                             │
└─────────────────────────────────────────────────┘
         ↓ triggers
┌─────────────────────────────────────────────────┐
│  Metadata Extraction (Epic 3)                    │
│  - Parser (JSZip → JSON)                         │
│  - Validator (Zod)                               │
│  - Filament Matcher                              │
└─────────────────────────────────────────────────┘
         ↓ feeds into
┌─────────────────────────────────────────────────┐
│  Product & Recipe System (Epic 4)                │
│  - Product/Variant CRUD                          │
│  - Relationship Manager                          │
│  - Recipe Generator                              │
│  - Wizard Orchestrator                           │
└─────────────────────────────────────────────────┘
         ↓ indexed by
┌─────────────────────────────────────────────────┐
│  Search & Discovery (Epic 5)                     │
│  - Search Service                                │
│  - Grid Renderer                                 │
│  - Filter Engine                                 │
└─────────────────────────────────────────────────┘
```

---

## Technology Stack and Decisions

### Technology and Library Decisions

| Category | Technology | Version | Rationale |
|----------|-----------|---------|-----------|
| **Frontend Framework** | React | 19.0.0 | Already established. Latest version with automatic batching, concurrent features |
| **Router** | TanStack Router | ^1.132.33 | File-based routing, type-safe, integrated with TanStack ecosystem |
| **Server Framework** | TanStack Start | ^1.132.36 | SSR + API routes in single framework, Cloudflare Workers deployment |
| **Data Fetching** | TanStack Query | ^5.66.0 | Server state management, caching, SSR integration via `setupRouterSsrQueryIntegration()` |
| **Language** | TypeScript | ^5.7.2 | Type safety, strict mode enabled, path aliases configured |
| **Build Tool** | Vite | ^7.1.7 | Fast HMR, optimized production builds, TanStack Start integration |
| **Styling** | TailwindCSS | ^3.4.17 | Utility-first, rapid UI development, mobile-first responsive design |
| **Style Utilities** | tailwind-merge | ^2.6.0 | Merge Tailwind classes without conflicts |
| **Component Library** | React Aria Components | ^1.4.0 | Accessible primitives, custom component library built on top (per UX spec) |
| **Validation** | Zod | ^3.23.8 | Runtime type validation, schema coercion, shared client/server schemas |
| **Database** | Xata | latest | Postgres-compatible, automatic branching, serverless, generous free tier |
| **ORM** | Prisma | ^6.1.0 | Type-safe database client, migrations, works with Xata |
| **File Storage** | Cloudflare R2 | N/A | S3-compatible object storage, free tier 10GB, integrated with Workers |
| **Deployment** | Cloudflare Workers | N/A | Edge compute, global distribution, Smart Placement, free tier suitable for MVP |
| **CI/CD** | Cloudflare Workers Builds | N/A | Automated git-based deployments, PR previews, environment management |
| **Testing** | Vitest | ^3.2.4 | Vite-native, fast, compatible with React Testing Library |
| **React Testing** | React Testing Library | ^16.3.0 | User-centric testing, accessibility focus |
| **Linting** | ESLint | ^9.37.0 | Flat config (v9), TypeScript plugin, React hooks plugin |
| **Formatting** | Prettier | ^3.6.2 | Code formatting, integrated with ESLint |
| **Zip Processing** | JSZip | ^3.10.1 | Client + server-side zip extraction, pure JavaScript, no native deps |
| **Image Resizing** | sharp | ^0.33.5 | High-performance server-side image processing. **Note**: Verify Cloudflare Workers compatibility; may need wasm build or fallback to canvas |
| **JSON Viewer** | react-json-view | ^1.21.3 | "Show All Metadata" feature, expandable tree view |
| **Fuzzy Search** | fuse.js (optional) | ^7.0.0 | Client-side fallback if Xata full-text search unavailable. Prefer server-side search for scalability |
| **HTTP Client** | Native fetch | Browser/Node | No additional library needed with TanStack Start server functions |
| **Icons** | Lucide React | ^0.462.0 | Lightweight, tree-shakeable SVG icons |
| **Date Utilities** | date-fns | ^4.1.0 | Lightweight date formatting, timestamp display |

**Libraries to Remove**:
- `redaxios@^0.5.1` - Not needed with TanStack Start server functions

**Libraries to Add**:
```bash
npm install zod prisma @prisma/client jszip sharp react-json-view lucide-react date-fns react-aria-components
npm install -D @types/jszip
```

### Architecture Decision Records (ADRs)

#### ADR-001: Use TanStack Start Server Functions over tRPC

**Status**: Accepted

**Context**: Need type-safe API layer between frontend and backend.

**Decision**: Use TanStack Start's built-in server functions with file-based API routes (`src/routes/api/`).

**Rationale**:
- File-based routing already established and working
- Built-in TypeScript inference without additional setup
- Cleaner integration with existing TanStack Router/Query mental model
- Simpler for intermediate developers (less abstraction)
- Sufficient for monolith architecture (no cross-service RPC needed)

**Consequences**:
- ✅ Faster development (no tRPC setup)
- ✅ Single mental model across routing and API
- ⚠️ Less procedural API design than tRPC
- ⚠️ If system later needs microservices, tRPC could be reconsidered

**Alternatives Considered**: tRPC (more procedural, better for complex APIs)

---

#### ADR-002: sharp for Server-Side Image Resizing with Fallback Strategy

**Status**: Accepted (with Epic 2 Story 2.5 verification spike)

**Context**: Need to auto-resize images >2MB or >1024x1024 per FR-3 and NFR-2.

**Decision**: Use `sharp` for server-side image resizing in API routes, with documented fallback strategy if Cloudflare Workers compatibility fails.

**Rationale**:
- Production-grade performance (libvips under the hood)
- Precise control over image quality and dimensions
- Common in Node.js ecosystems
- Server-side ensures consistent results

**Consequences**:
- ✅ High-quality, fast resizing
- ✅ Reduces client-side compute
- ⚠️ **Risk**: sharp requires native bindings - may not work in Cloudflare Workers
- ✅ **Mitigation**: Multi-tier fallback strategy documented below

**Verification Spike (Story 2.5.1)**: Test sharp in Cloudflare Workers dev environment
```typescript
// Test code to run in Worker
import sharp from 'sharp'

export async function testSharp() {
  try {
    const buffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#ff0000' }
    }).jpeg().toBuffer()
    return { success: true, size: buffer.length }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

**Fallback Strategy** (execute in order if previous fails):

1. **Primary: sharp with wasm build** (if native fails)
   - Package: `@img/sharp-wasm32` or equivalent
   - Performance: Slightly slower than native, acceptable for MVP
   - Implementation: Swap import, same API

2. **Secondary: Browser-side resize before upload** (if wasm unavailable)
   - Use HTML5 Canvas API in client
   - Implementation:
     ```typescript
     // Client-side utility
     async function resizeImage(file: File, maxWidth: 1024, maxHeight: 1024): Promise<Blob> {
       const img = await createImageBitmap(file)
       const canvas = document.createElement('canvas')
       // ... canvas resize logic
       return canvas.toBlob()
     }
     ```
   - Trade-offs: Client compute, inconsistent results across devices
   - Acceptable for MVP (users have modern browsers)

3. **Tertiary: Reject oversized images** (temporary degradation)
   - Upload validation: reject images >2MB or >1024x1024
   - User message: "Please resize image before upload (max 1024x1024, 2MB)"
   - Acceptable for MVP (rare scenario, manual workaround available)

**Decision Tree** (Story 2.5 implementation):
```
Upload image → Check size
  ├─ If ≤2MB AND ≤1024x1024 → Accept directly
  └─ If oversized
      ├─ Try sharp (native)
      │   ├─ Success → Resize → Upload
      │   └─ Fail → Try wasm
      │       ├─ Success → Resize → Upload
      │       └─ Fail → Use client-side resize
      │           ├─ Success → Upload
      │           └─ Fail → Reject with helpful message
```

**Implementation Timeline**:
- Sprint 2 (Epic 2): Attempt sharp native → fallback to client-side for MVP
- Post-MVP: Investigate wasm build or Cloudflare Images if needed

**Alternatives Considered**:
- Cloudflare Images (costs money after free tier, overkill for MVP)
- Always client-side (inconsistent, poor UX, but viable fallback)

---

#### ADR-003: Custom Component Library Built on React Aria Components

**Status**: Accepted

**Context**: Need accessible, reusable UI components for wizards, modals, grids, forms.

**Decision**: Build custom component library using React Aria Components as foundation, styled with Tailwind.

**Rationale**:
- UX specification explicitly calls for React Aria Components
- Provides accessible primitives (keyboard navigation, ARIA attributes, screen reader support)
- Full control over styling and behavior (Tailwind integration)
- No opinionated design system to override
- Aligns with NFR-5 baseline accessibility requirements

**Consequences**:
- ✅ Complete control over component design
- ✅ Tailwind-first styling
- ✅ Accessibility built-in (WAI-ARIA compliant)
- ⚠️ More initial development vs pre-built libraries (Shadcn, MUI)
- ⚠️ Need to build: Button, Modal, Dialog, Select, Combobox, Tabs, etc.

**Component Directory Structure**:
```
src/components/
├── ui/                # React Aria-based primitives
│   ├── Button.tsx
│   ├── Modal.tsx
│   ├── Dialog.tsx
│   ├── Select.tsx
│   ├── TextField.tsx
│   ├── Combobox.tsx
│   └── ...
├── forms/             # Form-specific components
│   ├── FileUpload.tsx
│   ├── ColorPicker.tsx
│   └── ...
├── layout/            # Layout components
│   ├── Grid.tsx
│   ├── Card.tsx
│   └── ...
└── wizards/           # Multi-step wizard
    ├── Wizard.tsx
    ├── WizardStep.tsx
    └── ...
```

**Alternatives Considered**:
- Shadcn/ui (pre-built, less control)
- Headless UI (less comprehensive than React Aria)
- Radix UI (similar to React Aria, but React Aria chosen per spec)

---

#### ADR-004: Xata Full-Text Search with ILIKE Fallback

**Status**: Accepted

**Context**: Need fuzzy search with typo tolerance across 1000+ products (FR-11, NFR-1: ≤1s response).

**Decision**: Use Xata's built-in full-text search if available; fall back to Postgres ILIKE + optional Levenshtein distance for typo tolerance.

**Rationale**:
- Xata provides Postgres full-text search capabilities
- ILIKE handles case-insensitive substring matching ("whale" in "Baby Whale")
- Levenshtein distance (pg_trgm extension) adds typo tolerance if needed
- Server-side search scales to 1000+ products (client-side fuse.js doesn't)
- No additional third-party costs

**Consequences**:
- ✅ Leverages database indexing (fast queries)
- ✅ No additional search service dependencies
- ✅ Meets ≤1s search response requirement
- ⚠️ Levenshtein may require Postgres extension (verify Xata supports pg_trgm)
- ⚠️ If performance degrades >1s, consider dedicated search index

**Implementation**:
```sql
-- Simple ILIKE substring match
SELECT * FROM products WHERE name ILIKE '%whale%';

-- With typo tolerance (if pg_trgm available)
SELECT * FROM products WHERE name % 'whle' ORDER BY similarity(name, 'whle') DESC;
```

**Alternatives Considered**:
- Algolia/Typesense (overkill for MVP, cost concerns)
- fuse.js (client-side, doesn't scale to 1000+ items)

---

#### ADR-005: Monorepo with File-Based Routing

**Status**: Accepted

**Context**: Repository strategy for TanStack Start application.

**Decision**: Single monorepo with file-based routing for pages and API endpoints.

**Rationale**:
- Aligns with serverless monolith architecture
- Shared TypeScript types between frontend/backend
- Single deployment artifact (Cloudflare Worker bundle)
- Simplified dependency management
- Atomic commits across stack

**Consequences**:
- ✅ No cross-repo coordination
- ✅ Type safety across frontend/backend
- ✅ Simple deployment pipeline
- ⚠️ Entire codebase in single repo (potential merge conflicts, but small team mitigates)

**Route Structure**:
```
src/routes/
├── __root.tsx                    # Root layout
├── index.tsx                     # Landing page (product catalog)
├── products/
│   ├── index.tsx                 # Product list
│   ├── $productId.tsx            # Product detail
│   └── new.tsx                   # Create product
├── models/
│   ├── index.tsx                 # Model list
│   ├── $modelId.tsx              # Model detail
│   ├── upload.tsx                # Upload models
│   └── upload-zip.tsx            # Upload zip
├── slices/
│   ├── index.tsx                 # Slice list
│   ├── $sliceId.tsx              # Slice detail
│   └── upload.tsx                # Upload slice (wizard)
├── filaments/
│   ├── index.tsx                 # Filament list
│   └── $filamentId.tsx           # Filament detail
├── recipe/
│   └── $uuid.tsx                 # Public recipe card
├── admin/
│   └── storage.tsx               # Storage dashboard
└── api/                          # Server-side API routes
    ├── models/
    │   ├── upload.ts             # POST /api/models/upload
    │   ├── upload-zip.ts         # POST /api/models/upload-zip
    │   └── $modelId.ts           # GET/DELETE /api/models/:id
    ├── slices/
    │   ├── upload.ts             # POST /api/slices/upload
    │   ├── extract-metadata.ts   # POST /api/slices/extract-metadata
    │   └── $sliceId.ts           # GET/DELETE /api/slices/:id
    ├── products/
    │   ├── index.ts              # GET /api/products (list)
    │   ├── create.ts             # POST /api/products
    │   └── $productId.ts         # GET/PATCH/DELETE /api/products/:id
    ├── filaments/
    │   ├── index.ts              # GET/POST /api/filaments
    │   ├── match.ts              # POST /api/filaments/match
    │   └── $filamentId.ts        # GET/PATCH/DELETE /api/filaments/:id
    └── search.ts                 # GET /api/search?q=...
```

**Alternatives Considered**: Polyrepo (unnecessary complexity for monolith)

---

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │  React 19 (SSR + Hydration)                         │    │
│  │  - TanStack Router (file-based routing)             │    │
│  │  - TanStack Query (server state)                    │    │
│  │  - Custom React Aria Components                     │    │
│  │  - Tailwind CSS                                     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────┐
│              CLOUDFLARE EDGE (Global Network)                │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Cloudflare Worker (TanStack Start SSR)             │    │
│  │  - Smart Placement (optimizes execution location)   │    │
│  │  - 100% observability (head sampling)               │    │
│  │  - Environment: dev/staging/production              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         ↓                      ↓                     ↓
    ┌─────────┐          ┌──────────┐        ┌──────────────┐
    │  Xata   │          │R2 Storage│        │ Cloudflare   │
    │Database │          │  Buckets │        │    Logs      │
    │         │          │          │        │(24hr retain) │
    │Postgres │          │- Models  │        └──────────────┘
    │         │          │- Slices  │
    │Branching│          │- Images  │
    │per env  │          │          │
    └─────────┘          └──────────┘

    dev/staging/production branches
    Auto-branching for PR previews
```

**Data Flow Examples**:

1. **Upload Zip Workflow**:
   ```
   User → Upload Zip Form → POST /api/models/upload-zip
     → Extract zip (JSZip) → Return file list
     → User selects files → POST /api/models/import
     → Upload to R2 (parallel) → Create DB records → Success
   ```

2. **Slice Upload with Metadata Extraction**:
   ```
   User → Upload Slice → POST /api/slices/upload
     → Upload to R2 → Extract metadata (JSZip + Zod)
     → Match filaments (smart matching algorithm)
     → Return wizard data (pre-populated)
     → User confirms/creates filaments → User creates product/variant
     → Link slice to variant → Recipe card available
   ```

3. **Search Products**:
   ```
   User → Type "whale" → GET /api/search?q=whale
     → Xata full-text search OR ILIKE query
     → Return product cards with thumbnails → Render grid
   ```

4. **View Recipe Card (Assistant Workflow)**:
   ```
   Assistant → Click recipe URL → GET /recipe/:uuid
     → Query variant + product + slice + filaments + metadata
     → Render recipe card (mobile-optimized)
     → Click download → R2 presigned URL → Download slice file
   ```

---

## Data Architecture

### Database Schema (Prisma)

**Complete schema optimized for Xata (Postgres-compatible)**:

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Core Entities

model Model {
  id           String   @id @default(uuid())
  tenantId     String?  // nullable in MVP, enforced in Phase 3
  filename     String
  r2Key        String
  r2Url        String
  fileSize     Int      // bytes
  contentType  String
  thumbnailUrl String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relationships
  sliceModels SliceModel[]

  @@index([tenantId])
  @@index([filename]) // for search
}

model Slice {
  id                String   @id @default(uuid())
  tenantId          String?
  filename          String
  r2Key             String
  r2Url             String
  fileSize          Int
  contentType       String
  thumbnailUrl      String?
  metadataExtracted Boolean  @default(false)
  metadataJson      Json?    // complete extracted metadata

  // Curated metadata fields (denormalized for performance)
  layerHeight      Float?
  nozzleTemp       Int?
  bedTemp          Int?
  printSpeed       Int?
  infillPercent    Int?
  supportsEnabled  Boolean?
  estimatedTimeSec Int?
  filamentUsedG    Float?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relationships
  sliceModels    SliceModel[]
  sliceFilaments SliceFilament[]
  sliceVariants  SliceVariant[]

  @@index([tenantId])
  @@index([metadataExtracted])
}

model Filament {
  id           String   @id @default(uuid())
  tenantId     String?
  brand        String   // normalized during matching
  colorHex     String   // e.g., "#FF5733"
  colorName    String?  // e.g., "Red"
  materialType String   // PLA, PETG, ABS, TPU, etc.
  filamentType String   // Basic, Matte, Silk, Sparkle, etc.
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relationships
  sliceFilaments SliceFilament[]

  @@unique([brand, colorHex, materialType, filamentType], name: "uniqueFilament")
  @@index([tenantId])
  @@index([brand])
  @@index([materialType])
}

model Product {
  id           String   @id @default(uuid())
  tenantId     String?
  name         String   @unique // unique constraint for product names
  description  String?
  thumbnailUrl String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relationships
  variants ProductVariant[]

  @@index([tenantId])
  @@index([name]) // for search
}

model ProductVariant {
  id           String   @id @default(uuid())
  productId    String
  tenantId     String?
  name         String   // unique within product
  thumbnailUrl String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relationships
  product       Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  sliceVariants SliceVariant[]

  @@unique([productId, name], name: "uniqueVariantPerProduct")
  @@index([tenantId])
  @@index([productId])
}

// Junction Tables (Many-to-Many Relationships)

model SliceModel {
  id        String   @id @default(uuid())
  sliceId   String
  modelId   String
  createdAt DateTime @default(now())

  // Relationships
  slice Slice @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  model Model @relation(fields: [modelId], references: [id], onDelete: Cascade)

  @@unique([sliceId, modelId])
  @@index([sliceId])
  @@index([modelId])
}

model SliceFilament {
  id           String   @id @default(uuid())
  sliceId      String
  filamentId   String?  // nullable to support filament deletion per FR-10
  amsSlotIndex Int      // 1-based, non-contiguous OK
  createdAt    DateTime @default(now())

  // Relationships
  slice    Slice     @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  filament Filament? @relation(fields: [filamentId], references: [id], onDelete: SetNull) // Allow deletion, nullify references

  // Note: Per FR-10, filament deletion is ALLOWED even when used in slices.
  // When filament is deleted:
  // 1. filamentId becomes null in this junction table
  // 2. Application layer detects null filamentId
  // 3. UI displays warning: "Missing filament for Slot X (was deleted)"
  // 4. Slice becomes unusable until user reassigns replacement filament
  // 5. User can manually update filamentId to different filament via UI
  // See FR-10 for complete deletion behavior specification.

  @@unique([sliceId, amsSlotIndex]) // slot numbers unique per slice
  @@index([sliceId])
  @@index([filamentId])
}

model SliceVariant {
  id               String   @id @default(uuid())
  sliceId          String
  variantId        String
  quantityPerPrint Int      @default(1)
  createdAt        DateTime @default(now())

  // Relationships
  slice   Slice          @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  variant ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([sliceId, variantId])
  @@index([sliceId])
  @@index([variantId])
}
```

### Entity-Relationship Diagram

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Model   │────┬───>│SliceModel│<───┬────│  Slice   │
└──────────┘    │    └──────────┘    │    └──────────┘
                │                    │           │
           many │                    │ many      │ many
                │                    │           │
                └────────────────────┘           │
                   (many-to-many)                │
                                                 ├───────┐
                                                 │       │
                                                 v       v
                                        ┌─────────────┐ ┌──────────────┐
                                        │SliceFilament│ │SliceVariant  │
                                        └─────────────┘ └──────────────┘
                                             │                 │
                                             v                 v
                                        ┌─────────┐     ┌──────────────┐
                                        │Filament │     │ProductVariant│
                                        └─────────┘     └──────────────┘
                                                              │
                                                              v
                                                        ┌──────────┐
                                                        │ Product  │
                                                        └──────────┘
```

### Key Relationships

1. **Models ↔ Slices** (many-to-many via `SliceModel`):
   - A slice can reference multiple models (multi-model plates)
   - A model can be used in multiple slices

2. **Slices ↔ Filaments** (many-to-many via `SliceFilament`):
   - A slice uses multiple filaments (multi-color prints)
   - Includes AMS slot assignment per filament
   - `onDelete: SetNull` allows filament deletion even when used (per FR-10)
   - When filament deleted: `filamentId` becomes null, UI shows warning, slice becomes unusable until reassigned

3. **Slices ↔ Variants** (many-to-many via `SliceVariant`):
   - A slice can produce multiple variants (e.g., same slice for different quantities)
   - A variant can have multiple slices (e.g., Red variant with different layer heights)
   - Includes `quantityPerPrint` at junction level

4. **Products → Variants** (one-to-many):
   - A product has multiple variants (e.g., Baby Whale → Red, Blue, Yellow)
   - Cascade delete: deleting product deletes all variants

### Indexes Strategy

**Search Performance**:
- `models.filename` - for model name search
- `products.name` - for product name search
- `filaments.brand`, `filaments.materialType` - for filter queries

**Relationship Queries**:
- `sliceModels.sliceId`, `sliceModels.modelId` - for bidirectional navigation
- `sliceFilaments.sliceId`, `sliceFilaments.filamentId` - for "Filament used in X slices"
- `sliceVariants.sliceId`, `sliceVariants.variantId` - for recipe card queries

**Multi-Tenancy (Future)**:
- All `tenantId` columns indexed for Phase 3 tenant isolation
- Currently nullable, will become `NOT NULL` with default in Phase 3

### Data Migration Strategy

**Initial Schema Setup** (Story 2.1):
```bash
# 1. Create Prisma schema (shown above)
npx prisma init

# 2. Generate Prisma Client
npx prisma generate

# 3. Push schema to Xata dev branch
npx prisma db push

# 4. Verify in Xata dashboard
```

**Schema Changes During Development**:
```bash
# Make schema changes in schema.prisma
# Create migration
npx prisma migrate dev --name add_metadata_fields

# Apply to staging
npx prisma migrate deploy # (in staging environment)

# Apply to production
npx prisma migrate deploy # (in production environment)
```

**Data Seeding (Development)**:
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed common filaments
  await prisma.filament.createMany({
    data: [
      { brand: 'Bambu Lab', colorHex: '#FF0000', colorName: 'Red', materialType: 'PLA', filamentType: 'Basic' },
      { brand: 'Bambu Lab', colorHex: '#0000FF', colorName: 'Blue', materialType: 'PLA', filamentType: 'Basic' },
      // ... more common filaments
    ]
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

## API Design

### API Route Patterns

All API routes use TanStack Start's file-based routing with `server.handlers` pattern:

```typescript
// src/routes/api/example.ts
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'

export const Route = createFileRoute('/api/example')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Access Cloudflare context
        const cf = getContext('cloudflare')
        const env = cf.env.ENVIRONMENT

        // Business logic here
        return json({ data: '...' })
      },
      POST: async ({ request }) => {
        const body = await request.json()
        // Handle POST
        return json({ success: true })
      }
    }
  }
})
```

### Key API Endpoints

#### Models API

**POST /api/models/upload** - Upload single model file
```typescript
// Request: multipart/form-data
{ file: File } // .stl or .3mf, max 500MB

// Response: 201 Created
{
  id: string
  filename: string
  r2Url: string
  thumbnailUrl?: string
}

// Errors: 400 (invalid file), 413 (too large), 500
```

**POST /api/models/upload-zip** - Extract zip file
```typescript
// Request: multipart/form-data
{ file: File } // .zip, max 500MB

// Response: 200 OK
{
  files: Array<{
    path: string
    filename: string
    type: 'model' | 'image'
    size: number
  }>
}

// Note: Files not yet uploaded to R2, awaiting user selection
```

**POST /api/models/import** - Import selected files from zip
```typescript
// Request
{
  zipId: string // temporary zip reference
  selectedFiles: string[] // file paths from extraction
}

// Response: 201 Created
{
  imported: Array<{
    id: string
    filename: string
    r2Url: string
  }>
}
```

**GET /api/models/:modelId** - Get model details
```typescript
// Response: 200 OK
{
  id: string
  filename: string
  r2Url: string
  thumbnailUrl?: string
  fileSize: number
  createdAt: string
  slices: Array<{ id: string, filename: string }> // related slices
}
```

**DELETE /api/models/:modelId** - Delete model
```typescript
// Response: 204 No Content

// Errors: 409 if model used in slices (check before delete)
```

#### Slices API

**POST /api/slices/upload** - Upload slice with metadata extraction
```typescript
// Request: multipart/form-data
{ file: File } // .gcode.3mf, max 50MB

// Response: 201 Created
{
  slice: {
    id: string
    filename: string
    r2Url: string
    metadataExtracted: boolean
  }
  extractedMetadata: {
    layerHeight: number
    nozzleTemp: number
    bedTemp: number
    // ... curated fields
    filaments: Array<{
      brand: string
      colorHex: string
      materialType: string
      filamentType: string
      amsSlotIndex: number
      matchedFilament?: { id: string, ... } // if auto-matched
    }>
  }
  suggestedProduct?: { id: string, name: string } // if model match found
}

// Errors: 400 (invalid format), 422 (metadata extraction failed)
```

**POST /api/slices/extract-metadata** - Re-extract metadata
```typescript
// Request
{ sliceId: string }

// Response: 200 OK (same as upload response)
```

**GET /api/slices/:sliceId** - Get slice details
```typescript
// Response: 200 OK
{
  id: string
  filename: string
  r2Url: string
  metadataExtracted: boolean
  curatedMetadata: { layerHeight, nozzleTemp, ... }
  completeMetadata?: Json // if requested via ?includeComplete=true
  filaments: Array<{ id, brand, colorHex, amsSlotIndex }>
  models: Array<{ id, filename }>
  variants: Array<{ id, productId, productName, variantName }>
}
```

#### Filaments API

**GET /api/filaments** - List all filaments
```typescript
// Query params: ?materialType=PLA&brand=Bambu

// Response: 200 OK
{
  filaments: Array<{
    id: string
    brand: string
    colorHex: string
    colorName?: string
    materialType: string
    filamentType: string
  }>
}
```

**POST /api/filaments** - Create new filament
```typescript
// Request
{
  brand: string
  colorHex: string
  colorName?: string
  materialType: string
  filamentType: string
}

// Response: 201 Created
{ id: string, ... }

// Errors: 409 if unique constraint violated
```

**POST /api/filaments/match** - Smart filament matching
```typescript
// Request
{
  brand: string
  colorHex: string
  materialType: string
  filamentType: string
}

// Response: 200 OK
{
  matched: boolean
  filament?: { id: string, ... }
  suggestions?: Array<{ id, brand, colorHex, score }> // if no exact match
}

// Algorithm:
// 1. Normalize brand (case-insensitive, trim)
// 2. Exact hex match
// 3. Material + type match
// 4. Return best match or suggestions
```

#### Products API

**GET /api/products** - List products
```typescript
// Query params: ?search=whale&limit=50

// Response: 200 OK
{
  products: Array<{
    id: string
    name: string
    thumbnailUrl?: string
    variantCount: number
  }>
  total: number
}
```

**POST /api/products** - Create product
```typescript
// Request
{
  name: string
  description?: string
  thumbnailUrl?: string
  variants?: Array<{
    name: string
    thumbnailUrl?: string
    slices?: Array<{ sliceId: string, quantityPerPrint: number }>
  }>
}

// Response: 201 Created
{
  id: string
  name: string
  variants: Array<{ id, name }>
}
```

**GET /api/products/:productId** - Get product with variants
```typescript
// Response: 200 OK
{
  id: string
  name: string
  description?: string
  thumbnailUrl?: string
  variants: Array<{
    id: string
    name: string
    thumbnailUrl?: string
    slices: Array<{
      id: string
      filename: string
      quantityPerPrint: number
    }>
  }>
}
```

#### Recipe Card API

**GET /api/recipe/:uuid** - Get recipe card data (public)
```typescript
// :uuid is variant ID

// Response: 200 OK
{
  product: { name: string, thumbnailUrl?: string }
  variant: { name: string }
  slices: Array<{
    id: string
    filename: string
    downloadUrl: string // R2 presigned URL
    quantityPerPrint: number
    estimatedTimeHours: number
    filaments: Array<{
      amsSlot: number
      brand: string
      colorName?: string
      colorHex: string
      materialType: string
    }>
    settings: {
      layerHeight: number
      nozzleTemp: number
      bedTemp: number
      infillPercent: number
      supports: boolean
    }
  }>
}

// Note: No authentication required (UUID is secret)
```

#### Search API

**GET /api/search** - Fuzzy search
```typescript
// Query params: ?q=whale&type=products

// Response: 200 OK
{
  results: Array<{
    type: 'product' | 'model' | 'slice'
    id: string
    name: string
    thumbnailUrl?: string
    relevance: number // 0-1 score
  }>
}

// Implementation: Xata full-text search or ILIKE with Levenshtein
```

### Error Response Format

Consistent error structure across all endpoints:

```typescript
// 4xx/5xx responses
{
  error: {
    code: string // machine-readable error code
    message: string // human-readable description
    field?: string // for validation errors
    details?: any // additional context
  }
}

// Examples:
// 400 Bad Request
{ error: { code: 'INVALID_FILE_TYPE', message: 'File must be .stl or .3mf' } }

// 409 Conflict
{ error: { code: 'DUPLICATE_PRODUCT', message: 'Product "Baby Whale" already exists', field: 'name' } }

// 422 Unprocessable Entity
{ error: { code: 'METADATA_EXTRACTION_FAILED', message: 'Invalid .gcode.3mf format', details: { ... } } }
```

---

## Proposed Source Tree

```
printfarm-manager/
├── .github/
│   └── workflows/                 # GitHub Actions (if needed beyond Cloudflare Builds)
├── docs/
│   ├── PRD.md
│   ├── epics.md
│   ├── ux-specification.md
│   ├── solution-architecture.md   # This document
│   └── technical-decisions.md
├── prisma/
│   ├── schema.prisma              # Database schema (from Data Architecture section)
│   ├── migrations/                # Auto-generated migration files
│   └── seed.ts                    # Dev data seeding script
├── public/
│   └── favicon.ico
├── src/
│   ├── routes/                    # File-based routing
│   │   ├── __root.tsx             # Root layout with navigation
│   │   ├── index.tsx              # Landing page (product catalog)
│   │   ├── products/
│   │   │   ├── index.tsx          # Product list
│   │   │   ├── $productId.tsx     # Product detail
│   │   │   └── new.tsx            # Create product
│   │   ├── models/
│   │   │   ├── index.tsx
│   │   │   ├── $modelId.tsx
│   │   │   ├── upload.tsx
│   │   │   └── upload-zip.tsx
│   │   ├── slices/
│   │   │   ├── index.tsx
│   │   │   ├── $sliceId.tsx
│   │   │   └── upload.tsx         # Wizard entry point
│   │   ├── filaments/
│   │   │   ├── index.tsx
│   │   │   └── $filamentId.tsx
│   │   ├── recipe/
│   │   │   └── $uuid.tsx          # Public recipe card
│   │   ├── admin/
│   │   │   └── storage.tsx        # Storage dashboard
│   │   └── api/                   # Server-side API routes
│   │       ├── models/
│   │       │   ├── upload.ts
│   │       │   ├── upload-zip.ts
│   │       │   ├── import.ts
│   │       │   └── $modelId.ts
│   │       ├── slices/
│   │       │   ├── upload.ts
│   │       │   ├── extract-metadata.ts
│   │       │   └── $sliceId.ts
│   │       ├── products/
│   │       │   ├── index.ts
│   │       │   ├── create.ts
│   │       │   └── $productId.ts
│   │       ├── filaments/
│   │       │   ├── index.ts
│   │       │   ├── match.ts
│   │       │   └── $filamentId.ts
│   │       ├── recipe/
│   │       │   └── $uuid.ts
│   │       └── search.ts
│   ├── components/                # React components
│   │   ├── ui/                    # React Aria-based primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── TextField.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Combobox.tsx
│   │   │   ├── Tabs.tsx
│   │   │   └── Toast.tsx
│   │   ├── forms/                 # Form components
│   │   │   ├── FileUpload.tsx
│   │   │   ├── ColorPicker.tsx
│   │   │   └── FormField.tsx
│   │   ├── layout/                # Layout components
│   │   │   ├── Grid.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Container.tsx
│   │   │   └── Header.tsx
│   │   ├── wizards/               # Multi-step wizards
│   │   │   ├── Wizard.tsx
│   │   │   ├── WizardStep.tsx
│   │   │   ├── SliceUploadWizard.tsx
│   │   │   └── ProductCreationWizard.tsx
│   │   ├── recipe/                # Recipe card components
│   │   │   ├── RecipeCard.tsx
│   │   │   ├── FilamentList.tsx
│   │   │   └── SettingsDisplay.tsx
│   │   └── shared/                # Shared utilities
│   │       ├── EnvironmentIndicator.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── SearchBar.tsx
│   ├── lib/                       # Shared utilities and types
│   │   ├── db/                    # Database utilities
│   │   │   ├── client.ts          # Prisma client initialization
│   │   │   └── queries.ts         # Complex queries
│   │   ├── storage/               # R2 storage utilities
│   │   │   ├── r2-client.ts       # R2 wrapper
│   │   │   └── upload.ts          # Upload helpers
│   │   ├── metadata/              # Metadata extraction
│   │   │   ├── extract.ts         # JSZip + JSON parsing
│   │   │   ├── validate.ts        # Zod schema validation
│   │   │   └── schemas.ts         # Zod schemas
│   │   ├── filaments/             # Filament matching
│   │   │   ├── matcher.ts         # Smart matching algorithm
│   │   │   └── normalizer.ts      # Brand/color normalization
│   │   ├── search/                # Search utilities
│   │   │   └── fuzzy.ts           # Fuzzy search implementation
│   │   ├── schemas/               # Shared Zod schemas
│   │   │   ├── upload.ts
│   │   │   ├── product.ts
│   │   │   ├── filament.ts
│   │   │   └── metadata.ts
│   │   ├── types/                 # TypeScript types
│   │   │   ├── api.ts             # API request/response types
│   │   │   ├── models.ts
│   │   │   └── recipe.ts
│   │   └── utils/                 # General utilities
│   │       ├── errors.ts          # Error handling
│   │       ├── logger.ts          # Structured logging
│   │       └── validation.ts      # Validation helpers
│   ├── styles/
│   │   └── globals.css            # Global styles, Tailwind imports
│   └── router.tsx                 # Router configuration
├── tests/                         # Vitest tests
│   ├── unit/
│   │   ├── metadata-extract.test.ts
│   │   ├── filament-matcher.test.ts
│   │   └── fuzzy-search.test.ts
│   ├── integration/
│   │   ├── upload-workflow.test.ts
│   │   └── recipe-card.test.ts
│   └── setup.ts                   # Test setup
├── .env.example                   # Example environment variables
├── .gitignore
├── eslint.config.mjs              # ESLint v9 flat config
├── package.json
├── prettier.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── wrangler.jsonc                 # Cloudflare Workers config
```

---

## Implementation Guidance

### Development Workflow

**Epic 1: Infrastructure Setup (Week 1-2)**

1. Configure environments in `wrangler.jsonc` (Story 1.1)
2. Set up Xata database with branching (Story 1.2)
3. Create R2 buckets per environment (Story 1.3)
4. Connect GitHub to Cloudflare Workers Builds (Story 1.4)
5. Implement logging infrastructure (Story 1.5)
6. Create storage dashboard (Story 1.7)

**Key Milestone**: All three environments operational with independent resources

**Epic 2: File Management (Week 3-4)**

1. Design and implement Prisma schema (Story 2.1)
2. Build model upload API route (Story 2.2)
3. Implement zip extraction (Story 2.3)
4. Create file selection UI (Story 2.4)
5. Add thumbnail handling with sharp (Story 2.5)
6. Implement slice upload API (Story 2.6)
7. Build delete operations (Story 2.7)
8. Create download functionality (Story 2.8)

**Key Milestone**: Can upload models, extract zips, manage files with R2+DB atomicity

**Epic 3: Metadata Extraction (Week 4-5)**

1. Implement metadata parser (JSZip + JSON) (Story 3.1)
2. Create Zod validation schemas (Story 3.2)
3. Build filament matching algorithm (Story 3.3)
4. Implement inline filament creation (Story 3.4)
5. Add AMS slot tracking (Story 3.5)
6. Build curated metadata display (Story 3.6)
7. Create extraction wizard UI (Story 3.7)

**Key Milestone**: Slice upload auto-extracts metadata, matches/creates filaments

**Epic 4: Products & Recipes (Week 6-7)**

1. Implement product/variant CRUD (Story 4.1-4.2)
2. Build slice-variant linking (Story 4.3)
3. Implement multi-model slice support (Story 4.4)
4. Create recipe card generator (Story 4.5)
5. Build product creation wizard (Story 4.6)
6. Implement "needs slicing" tracking (Story 4.7)
7. Create relationship navigation UI (Story 4.8)

**Key Milestone**: Can create products, link slices, generate recipe cards

**Epic 5: Search & Discovery (Week 8)**

1. Implement fuzzy search (Story 5.1-5.2)
2. Build grid browsing (Story 5.3)
3. Create landing page (Story 5.4)
4. Add basic filters (Story 5.5)
5. Finalize download operations (Story 5.6)

**Key Milestone**: MVP complete - full workflow from upload to recipe card

### Testing Strategy

**Unit Tests (>80% coverage per NFR-8)**:
- Metadata extraction (`tests/unit/metadata-extract.test.ts`)
- Filament matching (`tests/unit/filament-matcher.test.ts`)
- Fuzzy search (`tests/unit/fuzzy-search.test.ts`)
- Zod schema validation
- Upload helpers

**Integration Tests**:
- End-to-end workflows (`tests/integration/upload-workflow.test.ts`)
- Recipe card generation (`tests/integration/recipe-card.test.ts`)
- API route handlers
- Database operations

**Test Setup**:
```typescript
// tests/setup.ts
import { beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

beforeAll(async () => {
  // Clear test database
  await prisma.$executeRaw`TRUNCATE TABLE models CASCADE`
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

**Running Tests**:
```bash
# Run tests in watch mode
npm test

# Run once (CI)
npm run test:run

# Coverage report
npm run test:run -- --coverage
```

### Performance Optimization

**NFR-1 Compliance** (≤2s page loads, ≤1s search):

1. **Code Splitting**: Use dynamic imports for large components
   ```typescript
   const MetadataViewer = lazy(() => import('~/components/MetadataViewer'))
   ```

2. **Image Optimization**: Lazy load thumbnails, use appropriate sizes
   ```tsx
   <img loading="lazy" src={thumbnailUrl} width={200} height={200} />
   ```

3. **Database Indexing**: All search fields indexed (see Data Architecture)

4. **TanStack Query Caching**: Configure stale times
   ```typescript
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000, // 5 minutes
       },
     },
   })
   ```

5. **Skeleton Loaders**: Show placeholders during data fetch
   ```tsx
   {isLoading ? <GridSkeleton /> : <ProductGrid products={data} />}
   ```

### Security Considerations

**NFR-7 Compliance**:

1. **Input Sanitization**: Zod schemas validate all inputs
2. **File Upload Validation**: Type, size, content checks
3. **UUID-based URLs**: Recipe cards use UUIDs (not sequential IDs)
4. **CORS Configuration**: R2 buckets restricted to app domains
5. **No SQL Injection**: Prisma parameterized queries

**Future Phase 3 (Authentication)**:
- Multi-tenancy via `tenantId` (already in schema)
- Row-level security in database
- JWT-based authentication

---

## Next Steps

### Immediate Actions

1. **Review and Approve Architecture**: Stakeholder sign-off on this document
2. **Set Up Development Environment**:
   ```bash
   npm install zod prisma @prisma/client jszip sharp react-json-view lucide-react date-fns react-aria-components
   npm uninstall redaxios
   npx prisma init
   ```
3. **Configure Cloudflare Resources**: Xata database, R2 buckets, Workers Builds
4. **Begin Epic 1**: Start with Story 1.1 (environment configuration)

### Epic-Level Tech Specs

Per workflow requirements, each epic will receive a detailed technical specification before implementation begins. These specs will be generated from this architecture document and will include:

- Detailed component designs
- API contract specifications
- Database migration scripts
- Test coverage plans
- Acceptance criteria per story

---

## Appendix

### Technology Verification Required

1. **sharp in Cloudflare Workers**: Verify native bindings compatibility
   - **Test**: Upload image, resize in Worker, check success
   - **Fallback**: wasm-vips or client-side canvas

2. **Xata Full-Text Search**: Confirm pg_trgm extension availability
   - **Test**: Run similarity query in Xata console
   - **Fallback**: Simple ILIKE queries

3. **Prisma with Xata**: Verify migration workflow
   - **Test**: Run `prisma migrate dev` against Xata branch
   - **Fallback**: Direct SQL migrations if needed

### Environment Variables

```bash
# .env.example
DATABASE_URL="postgresql://..."  # Xata connection string
ENVIRONMENT="development"         # development|staging|production
```

### Cloudflare Secrets (set via wrangler)

```bash
# Development
echo "DATABASE_URL=..." > .dev.vars

# Staging/Production
npx wrangler secret put DATABASE_URL --env staging
npx wrangler secret put DATABASE_URL --env production
```

---

**Document Status**: Complete and ready for review
**Next Action**: Epic 1 kick-off and Story 1.1 implementation

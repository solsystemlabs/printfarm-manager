# printfarm-manager - Epic Breakdown

**Author:** Taylor
**Date:** 2025-10-10
**Project Level:** 3
**Target Scale:** MVP for personal print farm operations with future SaaS investigation

---

## Epic Overview

The PrintFarm Manager MVP is delivered through **5 epics** spanning approximately **31-36 user stories**. Epic sequencing prioritizes infrastructure foundation before feature development to ensure proper development workflow from day one.

### Delivery Timeline: 6-8 Weeks

**Epic 1: Deployment & Operations Foundation** (7 stories, Weeks 1-2, CRITICAL)
**Epic 2: Core File Management** (7-9 stories, Weeks 3-4, HIGH)
**Epic 3: Metadata Extraction & Filament Matching** (6-8 stories, Weeks 4-5, HIGH)
**Epic 4: Product & Recipe System** (8-10 stories, Weeks 6-7, HIGH)
**Epic 5: Search & Discovery** (5-7 stories, Week 8, MEDIUM)

---

## Epic 1: Deployment & Operations Foundation

**Goal:** Establish production-ready deployment pipeline and observability infrastructure before any feature development begins.

**Business Value:** Enables efficient development workflow with proper environments, automated deployments, and debugging capabilities. Without this foundation, feature development becomes chaotic and error-prone.

**Success Criteria:**
- Three environments operational (dev/staging/production) with independent databases and R2 buckets
- Automated deployments working via Netlify Git integration
- PR deploy preview URLs generating automatically
- Logs accessible in Netlify Dashboard with function-level observability

**Platform Evolution Note (2025-10-30)**: Stories 1.1-1.5 documented the original Cloudflare Workers infrastructure approach. During Epic 2 implementation, Cloudflare Workers memory limitations (128MB vs 500MB file processing requirement) proved incompatible with MVP needs. Story 1.8 documents the migration to Netlify Functions, which supersedes the Cloudflare-specific stories while preserving R2 for object storage.

### Story 1.1: Configure Cloudflare Workers Environments

**As a** developer
**I want** three distinct Cloudflare Workers environments configured in wrangler.jsonc
**So that** I can develop locally, test in staging, and deploy to production safely

**Prerequisites:** None (first story)

**Acceptance Criteria:**
1. `wrangler.jsonc` defines three environments: development (pm-dev), staging (pm-staging), production (pm)
2. Each environment has unique worker name to prevent conflicts
3. Environment-specific variables configured: `ENVIRONMENT` = "development"/"staging"/"production"
4. Smart Placement enabled in wrangler.jsonc (`placement: { mode: "smart" }`)
5. Observability configured with 100% head sampling rate
6. Local development runs with `npm run dev` using pm-dev configuration
7. Documentation updated with environment configuration details

**Technical Notes:**
- Use single wrangler.jsonc with `env` blocks for staging/production
- See CLAUDE.md for wrangler.jsonc structure reference

> **DEPRECATED (2025-10-30)**: This story was superseded by Story 1.8 (Netlify Migration) due to Cloudflare Workers memory limitations discovered during Epic 2 (Stories 2.2, 2.3, 2.4). See Story 1.8 for current deployment infrastructure. This story remains as historical documentation of the original platform choice.

---

### Story 1.2: Set Up Xata Database with Branching

**As a** developer
**I want** Xata database configured with branch-per-environment strategy
**So that** dev/staging/production have isolated data and PR previews get dedicated branches

**Prerequisites:** Story 1.1

**Acceptance Criteria:**
1. Xata project created with main database instance
2. Three persistent branches created: `dev`, `staging`, `production`
3. Database schema initialized (defer table definitions to Epic 2, just structure)
4. Xata CLI authenticated and configured locally
5. Environment variables set per environment pointing to correct Xata branch
6. Automated daily backups confirmed operational in Xata dashboard
7. PR preview branches configured to auto-create/delete with Cloudflare builds

**Technical Notes:**
- Xata provides automatic branching for PR previews
- Database migrations handled via Xata CLI or Prisma (decide during implementation)
- Connection strings stored as Cloudflare secrets (not in wrangler.jsonc)

> **DEPRECATED (2025-10-30)**: This story was superseded by Story 1.8, which migrates to Prisma Postgres with database branching capabilities. The Xata-specific branching infrastructure described here is no longer in use. This story remains as historical documentation.

---

### Story 1.3: Configure Cloudflare R2 Buckets

**As a** developer
**I want** separate R2 buckets for each environment
**So that** uploaded files don't mix between dev/staging/production

**Prerequisites:** Story 1.1

**Acceptance Criteria:**
1. Three R2 buckets created: `pm-dev-files`, `pm-staging-files`, `pm-files`
2. Each bucket has versioning enabled (for disaster recovery per NFR-12)
3. CORS configuration applied to allow uploads from application domains
4. Environment-specific bucket names configured in wrangler.jsonc bindings
5. Bucket access confirmed via test upload/download in each environment
6. Storage usage visible in Cloudflare Dashboard (manual monitoring per NFR-2)

**Technical Notes:**
- R2 free tier: 10GB storage, 1M class A ops/month, 10M class B ops/month
- Bucket bindings syntax: `[[r2_buckets]]` in wrangler.jsonc

> **DEPRECATED (Partially, 2025-10-30)**: R2 buckets remain in use, but access method changed. Story 1.8 documents R2 access via S3-compatible API using AWS SDK (replacing Wrangler native bindings described here). This story remains as historical documentation of the original R2 binding approach.

---

### Story 1.4: Implement Cloudflare Workers Builds CI/CD

**As a** developer
**I want** automated deployments via Cloudflare Workers Builds
**So that** pushing to master/production branches automatically deploys to staging/production

**Prerequisites:** Stories 1.1, 1.2, 1.3

**Acceptance Criteria:**
1. GitHub repository connected to Cloudflare Workers Builds
2. Build configuration set: `npm run build` command
3. Staging deployment configured for `master` branch using `npx wrangler deploy --env staging`
4. Production deployment configured for `production` branch using `npx wrangler deploy --env production`
5. PR preview builds configured to generate isolated preview URLs
6. Preview builds use `npx wrangler versions upload --env staging` (no impact on live staging)
7. Deployment completes in ≤5 minutes from git push (per NFR-10)
8. Failed builds prevent deployment and notify via Cloudflare Dashboard

**Technical Notes:**
- Cloudflare builds run in isolated environment
- Preview URLs format: `<branch-name>-pm-staging.<subdomain>.workers.dev`
- See CLOUDFLARE_SETUP.md for detailed configuration steps

> **DEPRECATED (2025-10-30)**: This story was superseded by Story 1.8, which uses Netlify's Git-based deployments instead of Cloudflare Workers Builds. The CI/CD concepts (branch-based deployments, PR previews) remain the same, but implementation differs. This story remains as historical documentation.

---

### Story 1.5: Implement Logging and Observability

**As a** developer
**I want** comprehensive logging for all API requests and errors
**So that** I can debug issues in staging/production environments

**Prerequisites:** Story 1.4

**Acceptance Criteria:**
1. Cloudflare Workers logs accessible in Dashboard for all environments
2. All API route handlers log request method, path, status code, duration
3. Error responses logged with descriptive messages (never stack traces per NFR-6)
4. Performance metrics logged: upload times, extraction times, search query times (per NFR-9)
5. Environment indicator (dev/staging/production) logged with each request
6. Logs filterable by environment, status code, time range in Cloudflare Dashboard
7. 100% request sampling confirmed operational (observability config from Story 1.1)

**Technical Notes:**
- Use `console.log()`, `console.error()` - automatically captured by Cloudflare
- Structured logging preferred: `console.log(JSON.stringify({ event, data }))`
- Cloudflare retains logs for 24 hours on free tier

> **DEPRECATED (2025-10-30)**: This story was superseded by Story 1.8, which uses Netlify Functions logging instead of Cloudflare Workers Dashboard. The observability goals remain the same, but implementation differs. This story remains as historical documentation.

---

### Story 1.7: Implement Storage Usage Visibility Dashboard

**As an** owner
**I want** to see total R2 storage consumed and file counts
**So that** I can monitor usage against free tier limits and plan for overages

**Prerequisites:** Stories 1.3, 1.5

**Acceptance Criteria:**
1. `/admin/storage` page accessible (no auth in MVP, but dedicated URL)
2. Dashboard displays total bytes stored across all file types
3. File counts broken down by type: models (.stl, .3mf), slices (.gcode.3mf, .gcode), images (.png, .jpg)
4. Storage displayed in human-readable format (GB/MB)
5. Visual indicator showing percentage of free tier limit (10GB)
6. Refresh button to recalculate storage usage on demand
7. Link to Cloudflare R2 Dashboard for detailed R2 usage analytics

**Technical Notes:**
- Storage calculated by querying database for all file records and summing sizes
- R2 doesn't provide automatic storage metrics API on free tier
- Consider caching storage calculations (expensive to recompute frequently)

---

### Story 1.8: Migrate from Cloudflare Workers to Netlify Functions

**As a** developer
**I want** to migrate the deployment platform from Cloudflare Workers to Netlify Functions
**So that** we can support larger file processing and use standard Node.js runtime patterns

**Prerequisites:** Stories 1.1-1.5 (understanding of original Cloudflare setup)

**Context:** Stories 2.2, 2.3, and 2.4 revealed fundamental incompatibilities between Cloudflare Workers runtime and TanStack Start's full-stack requirements. This migration supersedes the Cloudflare-specific infrastructure stories (1.1-1.5) while preserving R2 for object storage.

**Acceptance Criteria:**
1. Netlify site created and connected to GitHub repository
2. Build configuration defined in netlify.toml (development/staging/production contexts)
3. Custom domains configured: pm-staging.solsystemlabs.com, pm.solsystemlabs.com
4. Prisma Postgres workspace created with two databases (staging, production) - development uses local setup
5. Prisma schema updated to use standard generator (remove Cloudflare WASM generator)
6. R2 API tokens created and configured in Netlify environment variables
7. AWS SDK S3 client implemented for R2 access (replace native bindings)
8. All `getContext('cloudflare')` patterns replaced with `process.env` access
9. CLAUDE.md deployment section replaced with Netlify documentation
10. PRD infrastructure references updated
11. solution-architecture.md updated with new platform architecture
12. Story 2.2 code simplified (remove WASM generator, per-request connection factory)
13. Story 2.3 reverted to server-side extraction (remove client-side workaround)
14. Story 2.4 simplified (server handles zip extraction)
15. Successful deployment to all three environments with end-to-end testing

**Technical Notes:**
- Netlify Functions: 1GB memory (vs Workers 128MB), 10s timeout, Node.js 20 runtime
- Prisma Postgres: Database branching, standard PostgreSQL compatibility, native Netlify integration
- R2 access via S3-compatible API using @aws-sdk/client-s3
- See full story documentation: `/docs/stories/story-1.8.md`

**Effort Estimate:** 1-2 weeks

**Story Status:** Pending

**Detailed Documentation:** [Story 1.8](/docs/stories/story-1.8.md)

---

## Epic 2: Core File Management

**Goal:** Enable users to upload, store, and manage 3D model files and slice files with proper organization and thumbnail handling.

**Business Value:** Establishes foundation for all subsequent features. Users can centralize their scattered model files into organized system with visual browsing.

**Success Criteria:**
- Owner can upload 500MB zip files with recursive directory scanning
- System extracts and displays all valid files (.stl, .3mf, .png, .jpg) with thumbnails
- Owner can select which files to import from extraction results
- Uploaded files stored in R2 with database metadata tracking
- Individual .stl/.3mf file uploads supported
- Thumbnail auto-resize working for oversized images

### Story 2.1: Design Database Schema

**As a** developer
**I want** database schema defined for models, slices, products, variants, filaments
**So that** we have proper data structure before building features

**Prerequisites:** Epic 1 complete

**Acceptance Criteria:**
1. Schema designed with tables: models, slices, products, product_variants, filaments, slice_filaments, slice_models, slice_variants
2. Multi-tenant support: all tables include `tenant_id` column (nullable in MVP, enforced in Phase 3 per NFR-11)
3. Referential integrity defined with foreign keys
4. Many-to-many relationships properly modeled via junction tables
5. Unique constraints applied: product names, (brand+color+material+type) for filaments, variant names within product
6. UUID primary keys for all tables
7. Schema documented with ER diagram showing relationships
8. Migration scripts created and tested in dev environment

**Technical Notes:**
- Use Prisma for schema definition and migrations (integrates with Xata)
- Schema must support all FR requirements (review FR-1 through FR-18)
- tenant_id initially nullable, becomes NOT NULL in Phase 3

---

### Story 2.2: Implement Model File Upload API

**As an** owner
**I want** to upload individual .stl and .3mf files via web interface
**So that** I can add new models to my catalog

**Prerequisites:** Story 2.1

**Acceptance Criteria:**
1. API endpoint `/api/models/upload` accepts file uploads
2. Validates file type (only .stl, .3mf allowed per FR-1)
3. Validates file size (≤500MB per NFR-2, though individual models typically smaller)
4. Uploads file to R2 bucket with unique filename (UUID-based)
5. Creates database record with metadata: filename, size, content-type, R2 URL
6. Returns upload success response with model ID and URL
7. Handles errors gracefully: file too large, invalid type, R2 upload failure
8. Logs upload operation per NFR-9 (filename, size, outcome)

**Technical Notes:**
- Use TanStack Start file upload handling
- Set explicit content-type and content-disposition headers when uploading to R2 (per FR-16)
- Atomic operation: R2 first, DB second, cleanup R2 on DB failure (per NFR-4)

---

### Story 2.3: Implement Zip File Upload with Extraction

**As an** owner
**I want** to upload zip files containing multiple models and images
**So that** I can bulk-import entire model collections efficiently

**Prerequisites:** Story 2.2

**Acceptance Criteria:**
1. API endpoint `/api/models/upload-zip` accepts zip file uploads
2. Validates zip file size (≤500MB per NFR-2)
3. Extracts zip contents in-memory (server-side processing)
4. Recursively scans all directories within zip (supports nested folders per FR-1)
5. Identifies valid files: .stl, .3mf (models), .png, .jpg, .jpeg (images)
6. Ignores non-whitelisted files without errors
7. Returns list of discovered files with preview data (filename, size, type)
8. Does NOT upload to R2 or DB yet (awaits user selection in Story 2.4)
9. Temporary extraction files cleaned up after response sent
10. Handles malformed/corrupted zip files with descriptive error messages

**Technical Notes:**
- Use JSZip or similar library for zip extraction
- Memory-efficient streaming for large zips
- Processing may take >10 seconds for 500MB zips - return progress updates if feasible

---

### Story 2.4: Implement File Selection and Bulk Import UI

**As an** owner
**I want** to review extracted files and select which ones to import
**So that** I can exclude unwanted files (promos, alternate versions)

**Prerequisites:** Story 2.3

**Acceptance Criteria:**
1. UI displays all extracted files in grid layout with thumbnails
2. Image files show actual thumbnail previews
3. Model files (.stl, .3mf) show default 3D model icon placeholder
4. Each file has checkbox for selection (all selected by default)
5. Bulk actions: Select All, Deselect All
6. File info displayed: name, size, type
7. "Import Selected" button triggers bulk upload
8. Selected files uploaded to R2 and database records created (reuse Story 2.2 logic)
9. Progress indicator shows upload status (percentage-based per NFR-5)
10. Success confirmation lists imported files with thumbnails

**Technical Notes:**
- Frontend handles file selection, sends list of selected files to backend
- Backend re-validates selections against original extraction results (security)
- Batch upload may take time - consider queueing or parallel uploads

---

### Story 2.5: Implement Slice File Upload API

**As an** owner
**I want** to upload .gcode.3mf and .gcode slice files
**So that** I can attach sliced configurations to my models

**Prerequisites:** Story 2.1

**Acceptance Criteria:**
1. API endpoint `/api/slices/upload` accepts file uploads
2. Validates file type (.gcode.3mf, .gcode per FR-2)
3. Validates file size (≤50MB per NFR-2)
4. Uploads file to R2 bucket with unique filename
5. Creates database record with metadata: filename, size, content-type, R2 URL
6. Returns upload success response with slice ID and URL
7. Logs upload operation per NFR-9
8. NOTE: Metadata extraction deferred to Epic 3

**Technical Notes:**
- Slice uploads happen from model detail pages (UI context)
- Similar structure to Story 2.2 but different entity type

---

### Story 2.6: Implement Thumbnail Handling

**As an** owner
**I want** thumbnails automatically extracted and resized from uploaded files
**So that** my catalog has consistent visual presentation

**Prerequisites:** Stories 2.2, 2.3, 2.5

**Acceptance Criteria:**
1. Image files (.png, .jpg) uploaded as thumbnails during zip extraction
2. Oversized images (>2MB or >1024x1024) automatically resized to fit limits per NFR-2
3. Resizing preserves aspect ratio, uses high-quality scaling
4. If resizing fails or is complex, show oversized image as unselectable with warning per FR-3
5. Default placeholder image used when no thumbnail available
6. Thumbnails extracted from .gcode.3mf files (embedded in slice file) - defer extraction logic to Epic 3
7. Manual thumbnail upload/replace supported via UI (owner can change thumbnail anytime)

**Technical Notes:**
- Use sharp or canvas for image resizing (server-side)
- Thumbnail extraction from .gcode.3mf requires parsing - part of metadata extraction Epic
- Store both original and resized versions? Or just resized to save storage?

---

### Story 2.7: Implement Model CRUD Operations

**As an** owner
**I want** to view, edit, and delete model records
**So that** I can manage my model catalog over time

**Prerequisites:** Story 2.2

**Acceptance Criteria:**
1. Model detail page displays: thumbnail, filename, size, upload date, associated slices, products
2. Edit functionality: update model name, replace thumbnail
3. Delete functionality: hard delete per FR-17 (no soft delete in MVP)
4. Deletion warning shows related entities: "This model is used in 3 slices and 2 products"
5. Deleting model deletes associated R2 file (atomic operation per NFR-4)
6. Deletion breaks relationships - slices/products show warning "Missing model: [name]"
7. Model list page shows all models in visual grid with thumbnails and names per UX Principle 1

**Technical Notes:**
- Deletion must handle R2 + DB atomically (queue R2 deletion after DB commit per NFR-4)
- UI warnings prevent accidental deletions of heavily-used models

---

### Story 2.8: Implement Slice CRUD Operations

**As an** owner
**I want** to view, edit, and delete slice records
**So that** I can manage my slice configurations

**Prerequisites:** Story 2.5

**Acceptance Criteria:**
1. Slice detail page displays: thumbnail, filename, size, upload date, associated models, products, filaments
2. Edit functionality: update slice name (if extraction didn't provide good name)
3. Delete functionality: hard delete with warnings per FR-17
4. Deletion prevented if slice is last/only slice for a product variant (per FR-7)
5. Deleting slice deletes associated R2 file
6. Download button for slice file (sets proper headers per FR-16)
7. Slice list page shows all slices in visual grid

**Technical Notes:**
- Slice detail page will be enhanced in Epic 3 with metadata display
- Download must set content-disposition to force download (not inline view)

---

## Epic 3: Metadata Extraction & Filament Matching

**Goal:** Automatically extract all configuration data from Bambu Lab slice files and intelligently match filaments to existing records, eliminating manual data entry.

**Business Value:** Core automation that saves hours of manual work and enables recipe card generation. This is the primary value proposition of the system.

**Success Criteria:**
- .gcode.3mf files parsed and metadata extracted within 10 seconds
- Filament matching achieves >90% auto-match rate
- Wizard pre-populates all fields from extracted data
- Inline filament creation works seamlessly when no match found
- Metadata validation flags issues without blocking uploads

### Story 3.1: Implement .gcode.3mf File Parsing

**As a** developer
**I want** to extract JSON metadata from Bambu Lab .gcode.3mf files
**So that** we can auto-populate slice configuration data

**Prerequisites:** Epic 2 complete

**Acceptance Criteria:**
1. Parse .gcode.3mf files (ZIP format) and locate `Metadata/project_settings.config`
2. Extract JSON content from project_settings.config
3. Handle missing config file gracefully: skip metadata extraction, show warning per FR-2
4. Handle malformed JSON: fail upload with clear error message per FR-2
5. Validation succeeds for well-formed metadata
6. Extraction completes in ≤10 seconds for typical 50MB files per NFR-1
7. Logs extraction attempt with success/failure status per NFR-9

**Technical Notes:**
- .gcode.3mf is a ZIP archive (use JSZip or similar)
- See docs/bambu-lab-metadata-example.json for reference structure
- Extraction happens server-side during upload processing

---

### Story 3.2: Implement Metadata Schema Validation with Zod

**As a** developer
**I want** extracted metadata validated against expected schema
**So that** we catch format changes and missing fields early

**Prerequisites:** Story 3.1

**Acceptance Criteria:**
1. Zod schema defined for Bambu Lab metadata structure
2. Schema includes all fields needed for FRs: filaments, slicer settings, print metadata
3. Type coercion enabled for common conversions (string "220" → number 220 per FR-4)
4. Validation logs warnings for missing expected fields (for manual code adjustment per FR-4)
5. Validation flags unexpected field types as errors
6. Successful validation returns typed metadata object for downstream use
7. Failed validation provides descriptive error messages indicating which fields failed

**Technical Notes:**
- Zod schemas shared between client and server (per NFR-8)
- Schema documents expected structure (self-documenting code)
- Format changes detected via flagged failures - no automatic version detection (per FR-4)

---

### Story 3.3: Implement Smart Filament Matching Algorithm

**As an** owner
**I want** extracted filaments auto-matched to existing filament records
**So that** I don't have to manually select filaments during upload

**Prerequisites:** Story 3.2

**Acceptance Criteria:**
1. Matching criteria: brand (normalized), color (exact hex), material type, filament type per FR-5
2. Brand normalization: trim whitespace, case-insensitive comparison per FR-5
3. Color matching: exact hex match (e.g., #FF0000) per FR-5
4. Database query finds filament matching all four criteria
5. AMS slot assignment (`filament_self_index`) preserved from metadata per FR-6
6. Non-contiguous slot numbers supported (e.g., [1,2,4] valid) per FR-6
7. Returns matched filament IDs with slot assignments
8. Returns unmatched filaments with extracted metadata for inline creation

**Technical Notes:**
- Unique constraint on (brand, color, material, type) ensures one match per combination (per FR-5)
- Matching includes soft-deleted records with indicator (decided in elicitation) - wait, we removed soft delete!
- Since no soft delete in MVP, ignore soft-deleted matching logic

---

### Story 3.4: Implement Filament Management UI

**As an** owner
**I want** to manually create, edit, and view filament records
**So that** I can manage my filament inventory and prepare for matching

**Prerequisites:** Epic 2 Story 2.1 (DB schema)

**Acceptance Criteria:**
1. Filament list page displays all filaments with visual color swatches (hex color displayed)
2. Filament detail page shows: brand, color (hex + visual swatch), name, material, type
3. Reverse relationship view: "Used in 12 slices" with clickable list per FR-10
4. Create filament form: brand, color (hex picker), name, material dropdown, type dropdown
5. Edit filament: update any fields except (brand+color+material+type) combination if already used in slices
6. Delete filament: allowed even if used in slices per FR-10
7. Deletion warning shows affected slices: "This filament is used in 15 slices"
8. Deleted filament marks affected slices as unusable with warning per FR-10
9. UI provides manual reassignment workflow for affected slices

**Technical Notes:**
- Material types: PLA, PETG, ABS, TPU, etc. (dropdown populated from common materials)
- Filament types: Basic, Matte, Silk, Sparkle, etc.
- Color picker should allow manual hex entry and visual picker

---

### Story 3.5: Implement Inline Filament Creation in Upload Wizard

**As an** owner
**I want** to create new filament records during slice upload when no match found
**So that** upload workflow isn't blocked by missing filament records

**Prerequisites:** Stories 3.3, 3.4

**Acceptance Criteria:**
1. Wizard detects unmatched filaments after extraction
2. Inline form pre-populated with extracted metadata: brand, color hex, material, type
3. Owner can edit fields before creating
4. "Create Filament" button creates new record matching extracted metadata exactly per FR-5
5. Newly created filament immediately used for slice association
6. Multiple unmatched filaments handled sequentially (create first, then second, etc.)
7. Created filaments follow unique constraint (brand+color+material+type)
8. Form validation prevents duplicate creation if filament exists

**Technical Notes:**
- Inline creation maintains wizard flow - no separate page navigation
- Pre-population reduces data entry to confirmation clicks
- Wizard state persists created filaments if user navigates back/forward

---

### Story 3.6: Implement Curated Metadata Display

**As an** owner
**I want** to see key slicer settings by default with option to view all metadata
**So that** I'm not overwhelmed by hundreds of technical fields

**Prerequisites:** Story 3.2

**Acceptance Criteria:**
1. Slice detail page shows curated settings by default per FR-18:
   - Layer height, nozzle temperature, bed temperature, print speed
   - Infill percentage, support structure (yes/no)
   - Filament usage (grams), estimated print time
2. "Show All Metadata" toggle button reveals complete extracted JSON per FR-18
3. Curated fields displayed in user-friendly format (not raw JSON keys)
4. All metadata stored in database regardless of display (complete preservation)
5. Advanced view shows raw JSON in collapsible/expandable tree viewer
6. Debug mode toggle (per NFR-9) enables default-to-advanced view for troubleshooting

**Technical Notes:**
- Curated field list refined during development based on actual metadata analysis (per FR-18)
- Recipe cards also use curated display (different component, same principle)
- JSON tree viewer: consider react-json-view or similar library

---

### Story 3.7: Implement Metadata-Driven Wizard Flow

**As an** owner
**I want** slice upload wizard pre-populated with extracted metadata
**So that** I can confirm and proceed quickly without manual data entry

**Prerequisites:** Stories 3.1, 3.2, 3.3, 3.5

**Acceptance Criteria:**
1. Wizard triggered synchronously after .gcode.3mf upload per FR-2
2. Wizard displays extracted filaments with AMS slot assignments (immutable per FR-5)
3. Matched filaments shown with green checkmark indicator
4. Unmatched filaments show inline creation form per Story 3.5
5. Curated slicer settings displayed for review (read-only)
6. Owner clicks "Continue to Product Creation" to proceed (or "Save Without Product" to defer)
7. Wizard state preserved if owner navigates away (form persistence per NFR-6)
8. Extraction failures fall back to manual entry form per NFR-6
9. Metadata extraction logged with performance metrics per NFR-9

**Technical Notes:**
- Synchronous/blocking extraction per FR-2 decision
- Wizard UX critical for zero-friction uploads (UX Principle 2)
- Consider multi-step wizard component library (e.g., Headless UI Steps)

---

## Epic 4: Product & Recipe System

**Goal:** Enable creation of products with variants, linking slices to variants, and generating recipe cards with all information needed for autonomous reprints.

**Business Value:** Unlocks primary business goal - assistant autonomy. Recipe cards eliminate owner dependency and enable scaling.

**Success Criteria:**
- Owner can create products with multiple variants (colors/configurations)
- Each variant links to one or more slices
- Recipe cards generate with UUID URLs
- Recipe cards display filament slot assignments, curated settings, download button
- Assistant can access recipe card and execute print independently

### Story 4.1: Implement Product Entity CRUD

**As an** owner
**I want** to create and manage product records representing physical inventory items
**So that** I can organize my catalog by sellable products

**Prerequisites:** Epic 2 Story 2.1 (DB schema)

**Acceptance Criteria:**
1. Product create form: name (required, unique per FR-7), description (optional)
2. Product detail page displays: name, description, list of variants, associated slices
3. Products can be created without slices attached (marked incomplete/draft per FR-7)
4. Edit product: update name (validates uniqueness), description
5. Delete product: hard delete with warning about variants
6. Product list page shows all products in visual grid with thumbnails and names per UX Principle 1
7. Product card shows variant count: "Baby Whale (3 variants)"

**Technical Notes:**
- Product thumbnail fallback hierarchy: variant thumbnail → first model thumbnail → placeholder
- Product name uniqueness enforced at database level (unique constraint)

---

### Story 4.2: Implement Product Variant CRUD

**As an** owner
**I want** to create variants within products for different configurations
**So that** I can track color variations and configuration differences

**Prerequisites:** Story 4.1

**Acceptance Criteria:**
1. Variant create form (within product context): name (required), quantity-per-print (default 1)
2. Variant names unique within product scope per FR-7
3. Variant detail page shows: name, thumbnail, associated slices, filament requirements
4. Thumbnail priority: extracted from .gcode.3mf → user-uploaded → fallback to product thumbnail per FR-7
5. Edit variant: update name, quantity-per-print, replace thumbnail
6. Delete variant: hard delete with warnings
7. Variants displayed as cards/list within product detail page
8. Manual thumbnail upload/replace for variants

**Technical Notes:**
- Variants enable flexible many-to-many with slices (same slice can serve multiple variants)
- Quantity-per-print at slice-variant junction level per elicitation decision

---

### Story 4.3: Implement Slice-Variant Linking

**As an** owner
**I want** to associate slices with product variants
**So that** each variant has a recipe for reproduction

**Prerequisites:** Stories 4.2, Epic 2 Story 2.8

**Acceptance Criteria:**
1. UI to link existing slices to variants (many-to-many relationship per FR-7)
2. During wizard flow (Story 3.7), owner can create new variant OR select existing variant
3. Slice-variant junction stores quantity-per-print (per elicitation decision)
4. Variant can have multiple slices (e.g., different quality settings)
5. Slice can be used by multiple variants (e.g., shared configuration)
6. Prevention: cannot delete all slices from variant once at least one linked per FR-7
7. UI shows slice preview cards within variant detail page with "Unlink" button

**Technical Notes:**
- Junction table: slice_variants (slice_id, variant_id, quantity_per_print)
- Primary slice designation? Or just list all available slices per variant?

---

### Story 4.4: Implement Multi-Model Slice Support

**As an** owner
**I want** slices to reference multiple model files for multi-part prints
**So that** I can create plates with multiple models printed together

**Prerequisites:** Epic 2 Stories 2.7, 2.8

**Acceptance Criteria:**
1. Slice can link to multiple models via many-to-many relationship per FR-9
2. UI to select multiple models when creating/editing slice
3. All model relationships must be complete before slice usable per FR-9
4. Incomplete relationships show warnings: "Missing 2 of 4 models" per FR-9
5. Slice detail page lists all associated models with thumbnails
6. Easy navigation from slice → upload missing models → complete relationships per FR-9
7. Model detail page shows which slices use that model (reverse relationship)

**Technical Notes:**
- Junction table: slice_models (slice_id, model_id)
- "Multi-model plates" are simply slices with multiple model relationships (no separate plate entity per elicitation)

---

### Story 4.5: Implement Recipe Card Generation

**As an** owner
**I want** recipe cards auto-generated for products with complete slice data
**So that** I can share reproducible print instructions with assistants

**Prerequisites:** Stories 4.3, 4.4

**Acceptance Criteria:**
1. Recipe card generated only for variants with at least one complete slice per FR-8
2. UUID-based recipe card URLs (non-guessable per FR-8)
3. Recipe card validates slice file exists in R2 before display per FR-8
4. Recipe card displays per FR-8:
   - Product thumbnail (large, prominent)
   - "Download Slice" button
   - Filament requirements with AMS slots: "Slot 1: Red PLA (Bambu Lab)"
   - Curated slicer settings: layer height, temps, infill, supports
   - Estimated print time, filament usage
5. Recipe cards publicly accessible (no auth required per FR-8)
6. Multiple slices per variant: show all recipes OR designate primary?
7. Mobile-optimized layout per UX Principle 9 (recipe cards referenced at printer)

**Technical Notes:**
- Route: `/recipe/:uuid` where uuid is variant UUID or dedicated recipe UUID?
- Consider QR code generation for easy mobile access from desktop

---

### Story 4.6: Implement Product Creation from Wizard

**As an** owner
**I want** to create products directly from slice upload wizard
**So that** workflow is seamless from upload to recipe generation

**Prerequisites:** Stories 3.7, 4.1, 4.2, 4.3

**Acceptance Criteria:**
1. Wizard "Continue to Product Creation" step offers two paths:
   - Create new product + variant
   - Add variant to existing product
2. New product path: enter product name, variant name, quantity-per-print
3. Existing product path: select product from dropdown, enter variant name, quantity
4. Thumbnail defaults from wizard extraction (per UX Principle 8)
5. Success confirmation shows recipe card link after creation
6. Owner can skip product creation and save slice without linking (defer to later)
7. Wizard completion creates all entities atomically (product → variant → slice linkage)

**Technical Notes:**
- Wizard state must persist product/variant choices if extraction takes time
- Atomic transaction ensures all entities created or none (per NFR-4)

---

### Story 4.7: Implement "Needs Slicing" Tracking

**As an** owner
**I want** to mark models as needing slicing and view the list
**So that** I remember which models haven't been processed yet

**Prerequisites:** Epic 2 Story 2.7

**Acceptance Criteria:**
1. Model detail page has "Needs Slicing" boolean toggle per FR-15
2. Toggling on marks model with flag (database field: needs_slicing = true)
3. "Needs Slicing" list page shows all flagged models in grid view
4. List grows indefinitely in MVP per FR-15 (no archive/dismiss)
5. Flag automatically cleared when slice uploaded and linked to model? Or manual clear?
6. List sortable by date flagged (most recent first)
7. Clicking model in list navigates to model detail page for slice upload

**Technical Notes:**
- No notes field in MVP per elicitation decision (FR-15)
- Phase 2 will add notes/instructions and list management features

---

### Story 4.8: Implement Relationship Navigation UI

**As an** owner or assistant
**I want** to navigate between related entities easily
**So that** I can explore the catalog and understand connections

**Prerequisites:** Stories 4.1, 4.2, 4.3, 4.4, Epic 3 Story 3.4

**Acceptance Criteria:**
1. Filament detail page shows: "Used in X slices" with clickable list per FR-12
2. Model detail page shows: "Used in Y slices" and "Associated products" per FR-12
3. Product cards display variant count and slice status per FR-12
4. Slice detail page shows: associated models, filaments, products
5. Navigation achievable in ≤2 clicks from any entity to related entities per UX Principle 7
6. Broken relationships flagged with warnings: "Missing filament: Red PLA deleted" per UX Principle 7
7. Breadcrumb navigation shows current location in hierarchy per UX Principle 7

**Technical Notes:**
- Breadcrumbs helpful for deep navigation (Products → Baby Whale → Red Variant → Recipe)
- Reverse relationships require efficient queries (consider indexing)

---

## Epic 5: Search & Discovery

**Goal:** Enable fast, forgiving search across catalog and intuitive visual browsing to support catalog growth to 1000+ products.

**Business Value:** As catalog scales, search becomes essential for productivity. Assistants must find products quickly during production runs.

**Success Criteria:**
- Search returns results in <1 second
- Typo tolerance works ("whle" finds "whale")
- Visual grid browsing supports 1000+ products without performance degradation
- Search bar always accessible from all pages
- 95% of searches find target product in first 3 results

### Story 5.1: Implement Basic Search Infrastructure

**As an** owner or assistant
**I want** to search for products and models by name
**So that** I can quickly find what I need in a growing catalog

**Prerequisites:** Epic 4 Story 4.1

**Acceptance Criteria:**
1. Search bar component accessible from all pages (sticky header or prominent placement per FR-11)
2. Search scope: product names and model names (MVP scope per FR-11)
3. Case-insensitive substring matching: "whale" matches "Baby Whale Figurine" per FR-11
4. Search-as-you-type with debouncing (300ms delay) per UX Principle 6
5. Results displayed in visual grid with thumbnails per UX Principle 1
6. Empty state message when no results found
7. Search performance: results in ≤1 second per NFR-1

**Technical Notes:**
- Basic substring search using SQL LIKE or ILIKE (Postgres)
- Consider full-text search if available in Xata
- Debouncing prevents excessive queries while typing

---

### Story 5.2: Implement Fuzzy Search with Typo Tolerance

**As an** owner or assistant
**I want** search to work even with typos and partial matches
**So that** I don't have to remember exact product names

**Prerequisites:** Story 5.1

**Acceptance Criteria:**
1. Fuzzy matching with typo tolerance per FR-11 and UX Principle 6
2. Implementation options:
   - Option A: Third-party search solution if available (e.g., Xata full-text search, Algolia)
   - Option B: Levenshtein distance algorithm for fuzzy matching
3. Examples that should work:
   - "whle" finds "whale"
   - "bby" finds "baby"
   - "ocen" finds "ocean"
4. Results ranked by relevance (exact match first, then fuzzy matches)
5. Maximum edit distance: 2 characters (configurable)
6. Performance maintained: ≤1 second response time per NFR-1

**Technical Notes:**
- Evaluate third-party solutions first (per FR-11: "use third-party if available")
- Fallback to Levenshtein distance if no third-party option
- May need to index for fuzzy search performance at scale

---

### Story 5.3: Implement Visual Grid Browsing

**As an** owner or assistant
**I want** to browse all products in visual grid layout
**So that** I can recognize items by appearance quickly

**Prerequisites:** Epic 4 Story 4.1

**Acceptance Criteria:**
1. Product list page displays grid layout (default view per UX Principle 1)
2. Grid responsive: 4 columns desktop → 2 tablet → 1 mobile per UX Principle 9
3. Each card shows: thumbnail (200x200px minimum), product name, variant count
4. Grid supports 1000+ products without performance degradation per NFR-11
5. Lazy loading: load 50 products initially, infinite scroll or "Load More" button
6. Skeleton loaders during data fetch per UX Principle 10
7. Hover to enlarge thumbnails per UX Principle 1
8. Click card to navigate to product detail page

**Technical Notes:**
- Pagination deferred to Phase 2 unless needed (per NFR-11)
- Image optimization critical: lazy load images, use appropriate sizes
- Consider virtualized list for 1000+ items (react-window or similar)

---

### Story 5.4: Implement Landing Page with Search

**As an** owner or assistant
**I want** to see product list and search bar immediately on landing page
**So that** I can start searching or browsing right away

**Prerequisites:** Stories 5.1, 5.3

**Acceptance Criteria:**
1. Landing page (root `/`) displays product grid and search bar per FR-11
2. Search bar prominent and immediately interactive (autofocus optional)
3. Recent products shown first (sort by created_at DESC per UX Principle 8)
4. Page loads in ≤2 seconds per NFR-1
5. Mobile-responsive layout per UX Principle 9
6. No dashboard widgets in MVP (deferred per elicitation - UX simplification)
7. Simple, clean layout prioritizing visual browsing and search

**Technical Notes:**
- Landing page is primary entry point for assistant workflow
- Keep it fast and focused (no complex widgets or analytics)
- Dashboard enhancements deferred to Phase 2

---

### Story 5.5: Implement Basic Filtering

**As an** owner or assistant
**I want** to filter products by type or material
**So that** I can narrow down large catalogs

**Prerequisites:** Story 5.3

**Acceptance Criteria:**
1. Filter by file type: Models only, Slices only, Products with Recipes
2. Filter by material type: PLA, PETG, ABS, etc. (from filaments used in slices)
3. Filter by product name (basic text filter, complements search)
4. Filters collapsed by default, expand on click per UX Principle 5
5. Active filters displayed as removable tags
6. Filters combine with search (AND logic)
7. Filter state preserved in URL query params (shareable filtered views)

**Technical Notes:**
- MVP scope limited per FR-11 (advanced filters in Phase 2)
- Material filter requires join to filaments table via slices
- URL query params enable bookmarking filtered views

---

### Story 5.6: Implement File Download Operations

**As an** owner or assistant
**I want** to download individual slice and model files easily
**So that** I can load them into slicer or printer

**Prerequisites:** Epic 2 Stories 2.7, 2.8

**Acceptance Criteria:**
1. Download button on model detail pages for .stl/.3mf files
2. Download button on slice detail pages for .gcode.3mf/.gcode files
3. Download button on recipe cards for slice files (primary use case)
4. R2 URLs set with proper headers per FR-16:
   - content-type: application/octet-stream (or specific MIME type)
   - content-disposition: attachment; filename="baby-whale-red.gcode.3mf"
5. Downloads initiate immediately (no redirect delays)
6. Download errors handled gracefully: file missing, R2 unavailable
7. Mobile download works correctly (recipe card use case per UX Principle 9)

**Technical Notes:**
- Set headers explicitly when uploading to R2 per FR-16
- Fallback to R2 defaults if explicit setting not feasible per FR-16
- Test mobile download UX (primary assistant workflow)

---

### Story 5.7: Implement Storage Usage Dashboard (from Epic 1)

*Note: This story was included in Epic 1 as Story 1.7 but fits thematically with discovery/monitoring features. Ensure it's not duplicated.*

**Status:** Completed in Epic 1 Story 1.7

---

## Summary

### Total Story Count: 31 Stories

- **Epic 1:** 6 stories (Deployment & Operations)
- **Epic 2:** 8 stories (Core File Management)
- **Epic 3:** 7 stories (Metadata Extraction & Filament Matching)
- **Epic 4:** 8 stories (Product & Recipe System)
- **Epic 5:** 6 stories (Search & Discovery, with Story 5.7 already in Epic 1)

### Estimated Timeline: 6-8 Weeks

**Weeks 1-2:** Epic 1 complete (deployment foundation)
**Weeks 3-4:** Epic 2 complete (file management)
**Weeks 4-5:** Epic 3 complete (metadata extraction, some overlap with Epic 2 completion)
**Weeks 6-7:** Epic 4 complete (products and recipes)
**Week 8:** Epic 5 complete (search and discovery)

### Next Steps

1. **Architect Review:** Share PRD.md and epics.md with architect for solution architecture
2. **Story Refinement:** Detailed acceptance criteria review in sprint planning
3. **Technical Spikes:** Identify any unknowns requiring investigation (Xata branching, R2 header setting, fuzzy search options)
4. **Sprint Planning:** Break epics into 2-week sprints, typically 5-7 stories per sprint depending on complexity

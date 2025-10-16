# Epic Alignment Matrix

**Project**: printfarm-manager
**Date**: 2025-10-15
**Purpose**: Maps epics to architectural components, data models, APIs, and UI for implementation planning

---

## Epic-to-Component Mapping

| Epic | Primary Components | Data Models | API Routes | UI Components | Dependencies |
|------|-------------------|-------------|------------|---------------|--------------|
| **Epic 1: Infrastructure** | - Environment Config<br>- Database Branching<br>- R2 Buckets<br>- Observability Layer<br>- CI/CD Pipeline | None (infrastructure only) | None (infrastructure only) | - EnvironmentIndicator<br>- StorageDashboard | None (foundation) |
| **Epic 2: File Storage** | - Upload Service<br>- Zip Processor<br>- R2 Storage Client<br>- Thumbnail Service<br>- File Registry | - Model<br>- Slice<br>- (base tables) | - POST /api/models/upload<br>- POST /api/models/upload-zip<br>- POST /api/models/import<br>- GET/DELETE /api/models/:id<br>- POST /api/slices/upload<br>- GET/DELETE /api/slices/:id | - FileUpload<br>- Grid<br>- Card<br>- ModelList<br>- SliceList | Epic 1 (complete) |
| **Epic 3: Metadata** | - Metadata Parser<br>- Metadata Validator<br>- Filament Matcher<br>- Extraction Wizard | - Filament<br>- SliceFilament<br>- (Slice.metadata fields) | - POST /api/slices/extract-metadata<br>- POST /api/filaments/match<br>- GET/POST /api/filaments<br>- GET/PATCH/DELETE /api/filaments/:id | - SliceUploadWizard<br>- MetadataViewer<br>- FilamentMatcher<br>- ColorPicker | Epic 2 (Slice upload) |
| **Epic 4: Products** | - Product Service<br>- Relationship Manager<br>- Recipe Generator<br>- Wizard Orchestrator | - Product<br>- ProductVariant<br>- SliceVariant<br>- SliceModel | - GET/POST /api/products<br>- GET/PATCH/DELETE /api/products/:id<br>- GET /api/recipe/:uuid | - ProductCreationWizard<br>- RecipeCard<br>- FilamentList<br>- SettingsDisplay<br>- VariantManager | Epic 2 (files)<br>Epic 3 (metadata) |
| **Epic 5: Search** | - Search Service<br>- Grid Renderer<br>- Filter Engine<br>- Navigation Service | All entities (Product, Model, Slice, Filament) with indexes | - GET /api/search?q=...<br>- GET /api/products (with filters) | - SearchBar<br>- ProductGrid (lazy load)<br>- FilterPanel<br>- LandingPage | Epic 4 (products indexed) |

---

## Component Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│  Epic 1: Infrastructure & Deployment                         │
│  Provides: Runtime environment, database, storage, logging   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Epic 2: File Storage & Management                           │
│  Provides: File upload/download, R2 storage, base entities   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Epic 3: Metadata Extraction & Filament Matching             │
│  Provides: Auto-extraction, filament matching, AMS tracking  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Epic 4: Product & Recipe System                             │
│  Provides: Products, variants, recipe cards, wizards         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Epic 5: Search & Discovery                                  │
│  Provides: Search, grid browsing, landing page               │
└─────────────────────────────────────────────────────────────┘
```

**Critical Path**: Epic 1 → Epic 2 → Epic 3 → Epic 4 → Epic 5 (sequential)

**Parallel Opportunities**:
- Epic 2 stories 2.2-2.4 (model upload) can proceed independent of Epic 3
- Epic 3 can start metadata parser development while Epic 2 continues UI work
- Component library (Epic 1.6) can be developed in parallel with infrastructure setup

---

## Story Readiness Assessment

### Epic 1: Infrastructure (6-8 stories)
- **Ready for Tech Spec**: ✅ Yes
- **Blockers**: None
- **Prerequisites**: None (foundation epic)
- **Estimated Complexity**: Medium (configuration-heavy, low code)

### Epic 2: File Storage (7-9 stories)
- **Ready for Tech Spec**: ✅ Yes
- **Blockers**: None
- **Prerequisites**: Epic 1 complete (database schema deployed, R2 buckets created)
- **Estimated Complexity**: High (R2 integration, JSZip, sharp verification)

### Epic 3: Metadata Extraction (6-8 stories)
- **Ready for Tech Spec**: ✅ Yes
- **Blockers**: None
- **Prerequisites**: Epic 2 Story 2.6 (slice upload working)
- **Estimated Complexity**: High (metadata parsing, Zod schemas, matching algorithm)

### Epic 4: Products & Recipes (8-10 stories)
- **Ready for Tech Spec**: ✅ Yes
- **Blockers**: None
- **Prerequisites**: Epic 2 (files), Epic 3 (metadata extraction)
- **Estimated Complexity**: High (complex workflows, many relationships, wizard orchestration)

### Epic 5: Search & Discovery (5-7 stories)
- **Ready for Tech Spec**: ✅ Yes
- **Blockers**: None
- **Prerequisites**: Epic 4 (products created and indexed)
- **Estimated Complexity**: Medium (search implementation, grid rendering, lazy loading)

---

## Data Model Coverage

### Epic 1: Infrastructure
**Data Models**: None (creates database infrastructure)
**Migrations**: Initial Prisma schema setup

### Epic 2: File Storage
**Data Models**:
- Model (id, filename, r2Key, r2Url, fileSize, contentType, thumbnailUrl, createdAt, updatedAt)
- Slice (id, filename, r2Key, r2Url, fileSize, contentType, thumbnailUrl, metadataExtracted, metadataJson, createdAt, updatedAt)

**Relationships**: None yet (base tables only)

### Epic 3: Metadata Extraction
**Data Models**:
- Filament (id, brand, colorHex, colorName, materialType, filamentType, createdAt, updatedAt)
- SliceFilament (id, sliceId, filamentId, amsSlotIndex, createdAt)
- Slice (add curated metadata fields: layerHeight, nozzleTemp, bedTemp, etc.)

**Relationships**:
- Slice ↔ Filament (many-to-many via SliceFilament)

### Epic 4: Product & Recipe System
**Data Models**:
- Product (id, name, description, thumbnailUrl, createdAt, updatedAt)
- ProductVariant (id, productId, name, thumbnailUrl, createdAt, updatedAt)
- SliceVariant (id, sliceId, variantId, quantityPerPrint, createdAt)
- SliceModel (id, sliceId, modelId, createdAt)

**Relationships**:
- Product → ProductVariant (one-to-many)
- Slice ↔ ProductVariant (many-to-many via SliceVariant)
- Slice ↔ Model (many-to-many via SliceModel)

### Epic 5: Search & Discovery
**Data Models**: Uses all existing models with indexes
**Indexes Added**:
- Model.filename
- Product.name
- Filament.brand, Filament.materialType

---

## API Endpoint Coverage

### Epic 1: Infrastructure
**Endpoints**: None (infrastructure only)
**Environment Indicator**: Client-side component fetches from context

### Epic 2: File Storage
**Endpoints**:
- POST /api/models/upload
- POST /api/models/upload-zip
- POST /api/models/import
- GET /api/models/:modelId
- DELETE /api/models/:modelId
- POST /api/slices/upload (basic, no metadata yet)
- GET /api/slices/:sliceId
- DELETE /api/slices/:sliceId

### Epic 3: Metadata Extraction
**Endpoints**:
- POST /api/slices/upload (enhanced with metadata extraction)
- POST /api/slices/extract-metadata
- GET /api/filaments
- POST /api/filaments
- POST /api/filaments/match
- GET /api/filaments/:filamentId
- PATCH /api/filaments/:filamentId
- DELETE /api/filaments/:filamentId

### Epic 4: Product & Recipe System
**Endpoints**:
- GET /api/products
- POST /api/products
- GET /api/products/:productId
- PATCH /api/products/:productId
- DELETE /api/products/:productId
- GET /api/recipe/:uuid (public, no auth)

### Epic 5: Search & Discovery
**Endpoints**:
- GET /api/search?q=...&type=products

---

## UI Component Coverage

### Epic 1: Infrastructure
**Components**:
- EnvironmentIndicator (footer)
- StorageDashboard (/admin/storage)

### Epic 2: File Storage
**Components**:
- FileUpload (drag-and-drop, progress)
- Grid (thumbnail grid, lazy load)
- Card (product/model cards)
- ModelList (/models)
- SliceList (/slices)
- ModelDetail (/models/:id)
- SliceDetail (/slices/:id)

**React Aria Primitives Needed**:
- Button
- Modal
- TextField

### Epic 3: Metadata Extraction
**Components**:
- SliceUploadWizard (multi-step)
- MetadataViewer (JSON tree, toggle)
- FilamentMatcher (inline creation)
- ColorPicker (hex + visual)

**React Aria Primitives Needed**:
- Dialog
- Combobox (filament search)
- Tabs (wizard steps)

### Epic 4: Product & Recipe System
**Components**:
- ProductCreationWizard (multi-step)
- RecipeCard (/recipe/:uuid, mobile-optimized)
- FilamentList (with AMS slots)
- SettingsDisplay (curated metadata)
- VariantManager (product variants)
- ProductList (/products)
- ProductDetail (/products/:id)

**React Aria Primitives Needed**:
- Select (dropdowns)
- Toast (notifications)

### Epic 5: Search & Discovery
**Components**:
- SearchBar (always visible, debounced)
- ProductGrid (4 cols → 2 → 1 responsive, lazy load)
- FilterPanel (material, file type)
- LandingPage (product catalog)

**React Aria Primitives Needed**:
- (All from previous epics)

---

## Cross-Cutting Concerns

### All Epics
**Shared Utilities**:
- logger.ts (structured logging, Epic 1)
- errors.ts (error handling, all epics)
- validation.ts (Zod helpers, Epic 2+)

**Shared Patterns**:
- R2 + DB atomic operations (Epic 2+)
- Zod validation (Epic 2+)
- TanStack Query mutations (all epics with API calls)

### Testing Coverage

| Epic | Unit Tests | Integration Tests |
|------|-----------|-------------------|
| Epic 1 | Config validation, environment detection | End-to-end deployment workflow |
| Epic 2 | File validation, upload helpers, thumbnail resize | Zip extraction workflow, file CRUD |
| Epic 3 | Metadata parser, filament matcher, Zod schemas | Slice upload → metadata extraction → filament creation |
| Epic 4 | Recipe generator, relationship helpers | Product creation → recipe card generation |
| Epic 5 | Fuzzy search algorithm, filter logic | Search → grid rendering → pagination |

**Target Coverage**: >80% (per NFR-8)

---

## Implementation Sequence

### Week 1-2: Epic 1 (Infrastructure)
**Goal**: All 3 environments operational
**Milestone**: Can deploy to dev/staging/production with logging

### Week 3-4: Epic 2 (File Storage)
**Goal**: File upload/download working
**Milestone**: Can upload models, extract zips, manage files

### Week 4-5: Epic 3 (Metadata Extraction) *overlaps with Epic 2*
**Goal**: Metadata auto-extraction working
**Milestone**: Slice upload extracts metadata, matches filaments

### Week 6-7: Epic 4 (Products & Recipes)
**Goal**: Recipe cards functional
**Milestone**: Can create products, link slices, view recipe cards

### Week 8: Epic 5 (Search & Discovery)
**Goal**: Full catalog browsing
**Milestone**: MVP complete - search, browse, recipe cards working

**Total Duration**: 8 weeks (6-8 weeks estimated in PRD)

---

## Risk Assessment

| Epic | Risk Level | Key Risks | Mitigation |
|------|-----------|-----------|------------|
| Epic 1 | Low | Cloudflare config complexity | Well-documented in CLAUDE.md, existing setup |
| Epic 2 | Medium-High | sharp compatibility, large file handling | ADR-002 fallbacks, JSZip proven library |
| Epic 3 | High | Metadata format changes, matching accuracy | Zod validation, flagged failures per FR-4 |
| Epic 4 | Medium | Complex wizard flows, many relationships | Incremental development, UX spec detailed |
| Epic 5 | Medium | Search performance at scale | Xata indexes, ADR-004 fallback strategy |

**Highest Risk**: Epic 3 (metadata extraction) - critical path for business value

---

**Matrix Status**: COMPLETE
**Next Action**: Generate tech specs for each epic
**Usage**: Reference during tech spec generation and sprint planning

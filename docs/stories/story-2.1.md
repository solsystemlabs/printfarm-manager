# Story 2.1: Design Database Schema

Status: Ready for Review

## Story

As a developer,
I want database schema defined for models, slices, products, variants, filaments,
so that we have proper data structure before building features.

## Acceptance Criteria

1. Prisma schema created with all tables (models, slices, products, product_variants, filaments, slice_filaments, slice_models, slice_variants)
2. Multi-tenant support via tenant_id (nullable in MVP, enforced in Phase 3)
3. Foreign keys and relationships properly defined with correct cascade behavior
4. Unique constraints applied: product names, (brand+color+material+type) for filaments, variant names within product
5. UUID primary keys for all tables
6. Indexes created for search (filename, name) and relationship queries (tenantId, foreign keys)
7. Migration generated and tested in dev environment
8. Prisma Client generated successfully
9. ER diagram documented (reference in solution-architecture.md)

## Tasks / Subtasks

- [x] Create Prisma Schema (AC: #1, #2, #3, #4, #5, #6)
  - [x] Define datasource and generator blocks
  - [x] Create Model entity with fields and indexes
  - [x] Create Slice entity with metadata fields
  - [x] Create Filament entity with unique constraint
  - [x] Create Product and ProductVariant entities
  - [x] Create junction tables: SliceModel, SliceFilament, SliceVariant
  - [x] Add relationship annotations (@relation)
  - [x] Add indexes for search and foreign keys

- [x] Create Prisma Client Singleton (AC: #8)
  - [x] Create `/src/lib/db/client.ts` with singleton pattern
  - [x] Configure logging based on NODE_ENV
  - [x] Prevent multiple Prisma Client instances

- [x] Generate and Test Migration (AC: #7)
  - [x] Run `npx prisma generate` to create Prisma Client
  - [x] Run `npx prisma migrate dev --name init_schema`
  - [x] Verify migration creates all tables in local database
  - [x] Verify indexes created correctly
  - [x] Test basic CRUD queries with Prisma Client

- [x] Document Schema (AC: #9)
  - [x] Create or update ER diagram showing entity relationships
  - [x] Document in solution-architecture.md if exists
  - [x] Add inline schema comments documenting purpose of key fields

## Dev Notes

### Technical Approach

**Database Schema Design Strategy:**

This story implements the complete database schema for all epics (2-5) following the principle of designing the full data model upfront. The schema uses Prisma ORM with PostgreSQL (Xata-hosted) to support:

- **Multi-tenancy:** All tables include `tenant_id` nullable field (MVP allows null, Phase 3 enforces NOT NULL)
- **Relationships:** Proper many-to-many via junction tables (SliceModel, SliceFilament, SliceVariant)
- **Data integrity:** Foreign keys with appropriate cascade/restrict behaviors
- **Performance:** Strategic indexes on search fields and foreign keys
- **Type safety:** Prisma generates fully-typed client for compile-time validation

**Key Design Decisions:**

1. **UUID Primary Keys:** All entities use UUID for globally unique identifiers and future distributed system compatibility
2. **Denormalized Metadata:** Slice entity stores both complete metadata JSON and denormalized curated fields for query performance
3. **Cascade Deletion:** Junction tables cascade on delete to prevent orphaned relationships
4. **SetNull on Filaments:** Filament deletion ALLOWED even when used in slices - filamentId set to null, UI displays warning "Missing filament for Slot X (was deleted)" per FR-10
5. **Unique Constraints:** Product names globally unique; filament combinations unique; variant names unique per product

**Schema Organization:**

Per tech spec lines 78-266, schema organized into logical sections:
- Core File Entities (Epic 2): Model, Slice
- Filament & Matching (Epic 3): Filament, SliceFilament
- Product & Recipe System (Epic 4): Product, ProductVariant
- Junction Tables: SliceModel, SliceVariant

### Project Structure Notes

**Files to Create:**

- `/prisma/schema.prisma` - Complete Prisma schema definition
- `/src/lib/db/client.ts` - Singleton Prisma Client instance
- `/prisma/migrations/<timestamp>_init_schema/migration.sql` - Auto-generated SQL migration

**Alignment with Project Structure:**

This story establishes the data foundation for the entire PrintFarm Manager system. The schema supports:
- Epic 2: File storage tracking (models, slices)
- Epic 3: Metadata extraction and filament matching
- Epic 4: Product catalog and recipe generation
- Epic 5: Search capabilities (indexed fields)

**Database Configuration:**

The project uses dual database strategy per Epic 1 Story 1.2:
- **Local Development:** Docker PostgreSQL (via docker-compose.yml)
- **Deployed Environments:** Xata PostgreSQL (dev/staging/production branches)

Both use the same Prisma schema ensuring environment parity. The singleton pattern in `/src/lib/db/client.ts` manages connection pooling correctly for Cloudflare Workers edge runtime.

**Migration Strategy:**

Per tech spec lines 270-282:
1. Local: `npx prisma migrate dev` - Interactive migrations with schema drift detection
2. Staging/Production: `npx prisma migrate deploy` - Automated migrations in CI/CD

Cloudflare builds automatically run `prisma migrate deploy` after build completes.

### References

**Source Documents:**

- [Source: docs/epics.md, Story 2.1, lines 216-238] - User story and acceptance criteria
- [Source: docs/tech-spec-epic-2.md, Story 2.1, lines 63-312] - Complete schema definition and implementation guide
- [Source: docs/tech-spec-epic-2.md, Database Schema, lines 74-266] - Full Prisma schema code

**Technical Standards:**

- UUID primary keys across all entities (tech spec line 95, 114, 154, etc.)
- Multi-tenant field pattern: `tenant_id String? @map("tenant_id")` (tech spec lines 95, 115, 155, 196, 214)
- Unique filament constraint: `@@unique([brand, colorHex, materialType, filamentType])` (tech spec line 166)
- Cascade behavior: Junction tables use `onDelete: Cascade` (tech spec lines 242, 258)
- SetNull behavior: Filaments use `onDelete: SetNull` to allow deletion while preserving slice records (per FR-10 and brainstorming decision)

**Database Migration Commands:**

Per tech spec lines 270-282:
```bash
# Generate Prisma Client
npx prisma generate

# Create migration (dev)
npx prisma migrate dev --name init_schema

# Apply migration (staging/production)
npx prisma migrate deploy
```

**Prisma Client Singleton Pattern:**

Per tech spec lines 286-300, singleton pattern prevents multiple client instances:
- Uses global object to store single instance
- Enables query logging in development
- Only logs errors in production for performance

**Field Mapping Examples:**

- `r2Key String @map("r2_key")` - Maps Prisma camelCase to database snake_case
- Index syntax: `@@index([tenantId])` - Single field index
- Composite unique: `@@unique([brand, colorHex, materialType, filamentType], name: "unique_filament")`

## Dev Agent Record

### Context Reference

- Story Context XML: `/home/taylor/projects/printfarm-manager/docs/story-context-2.1.xml` (Generated: 2025-10-18)

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log

**Implementation completed 2025-10-19:**

1. Created complete Prisma schema with all 8 tables (models, slices, filaments, slice_filaments, products, product_variants, slice_models, slice_variants)
2. Implemented multi-tenant support via nullable `tenant_id` fields
3. Added all foreign key relationships with proper cascade behaviors:
   - Junction tables: `onDelete: Cascade` (auto-cleanup)
   - Filaments: `onDelete: SetNull` (allows deletion with warning, per FR-10)
4. Applied unique constraints:
   - Product names: globally unique
   - Filaments: composite unique on (brand, colorHex, materialType, filamentType)
   - Variants: unique name per product
5. Created indexes for performance:
   - Search fields: filename, name
   - Relationship queries: tenantId, foreign keys
   - Metadata queries: metadataExtracted
6. Generated two migrations:
   - `20251019215114_init_schema` - Initial schema creation
   - `20251019215820_fix_filament_deletion_behavior` - Changed from RESTRICT to SET NULL
7. Created Prisma Client singleton at `/src/lib/db/client.ts`
8. Comprehensive test suite (23 tests) validating:
   - Table creation
   - CRUD operations
   - Unique constraints
   - Cascade behaviors
   - SetNull behavior for filament deletion
   - Metadata storage (JSON and denormalized fields)

**Technical Decision - Filament Deletion:**
Implemented `onDelete: SetNull` instead of `RESTRICT` to match brainstorming decision. This allows users to delete filaments even when referenced in slices, with UI displaying warnings about missing filaments. The nullable `filamentId?` field makes this broken state explicitly representable in the type system.

### Completion Notes

✅ **All acceptance criteria met:**
1. ✅ Prisma schema created with all 8 tables
2. ✅ Multi-tenant support via nullable tenant_id
3. ✅ Foreign keys and relationships with correct cascade behaviors (Cascade and SetNull)
4. ✅ Unique constraints applied correctly
5. ✅ UUID primary keys for all tables
6. ✅ Indexes created for search and relationship queries
7. ✅ Migrations generated and tested successfully in local PostgreSQL
8. ✅ Prisma Client generated and singleton pattern implemented
9. ✅ ER diagram already documented in solution-architecture.md

**Tests:** 23 passing tests in `/src/lib/db/__tests__/` covering all entities, relationships, and constraints.

**Database Status:** Local PostgreSQL running via Docker, migrations applied, all tables created with proper structure.

### File List

**Created:**
- `/prisma/schema.prisma` - Complete schema with 8 models
- `/src/lib/db/client.ts` - Prisma Client singleton
- `/src/lib/db/__tests__/client.test.ts` - Client tests (3 tests)
- `/src/lib/db/__tests__/schema.test.ts` - Schema validation tests (20 tests)
- `/prisma/migrations/20251019215114_init_schema/migration.sql` - Initial migration
- `/prisma/migrations/20251019215820_fix_filament_deletion_behavior/migration.sql` - SetNull fix
- `/.env` - Database URL for local development

**Modified:**
- None (greenfield implementation)

### Change Log

- 2025-10-19: Implemented complete database schema with all entities, relationships, indexes, and constraints. Created migrations and comprehensive test suite. All acceptance criteria met.

# Story 2.1: Design Database Schema

Status: ContextReadyDraft

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

- [ ] Create Prisma Schema (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Define datasource and generator blocks
  - [ ] Create Model entity with fields and indexes
  - [ ] Create Slice entity with metadata fields
  - [ ] Create Filament entity with unique constraint
  - [ ] Create Product and ProductVariant entities
  - [ ] Create junction tables: SliceModel, SliceFilament, SliceVariant
  - [ ] Add relationship annotations (@relation)
  - [ ] Add indexes for search and foreign keys

- [ ] Create Prisma Client Singleton (AC: #8)
  - [ ] Create `/src/lib/db/client.ts` with singleton pattern
  - [ ] Configure logging based on NODE_ENV
  - [ ] Prevent multiple Prisma Client instances

- [ ] Generate and Test Migration (AC: #7)
  - [ ] Run `npx prisma generate` to create Prisma Client
  - [ ] Run `npx prisma migrate dev --name init_schema`
  - [ ] Verify migration creates all tables in local database
  - [ ] Verify indexes created correctly
  - [ ] Test basic CRUD queries with Prisma Client

- [ ] Document Schema (AC: #9)
  - [ ] Create or update ER diagram showing entity relationships
  - [ ] Document in solution-architecture.md if exists
  - [ ] Add inline schema comments documenting purpose of key fields

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
4. **Restrict on Filaments:** Filament deletion restricted if used in slices (prevents breaking recipes)
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
- Cascade behavior: Junction tables use `onDelete: Cascade` (tech spec lines 182, 242, 258)
- Restrict behavior: Filaments use `onDelete: Restrict` to prevent deletion when in use (tech spec line 182)

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

### Debug Log References

### Completion Notes List

### File List

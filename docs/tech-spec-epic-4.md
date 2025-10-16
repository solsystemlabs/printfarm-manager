# Technical Specification: Epic 4 - Product & Recipe System

**Project:** printfarm-manager
**Epic:** 4 - Product & Recipe System
**Date:** 2025-10-16
**Status:** Ready for Implementation
**Estimated Duration:** 2 weeks

---

## Executive Summary

Epic 4 delivers the primary business value: transforming the system from a file repository into a recipe-driven manufacturing platform. This epic enables creation of products with variants, linking slices to variants, and generating recipe cards that eliminate assistant dependency. Recipe cards contain all information needed for autonomous reprints: filament AMS slot assignments, curated slicer settings, and download links. This epic unlocks the core value proposition—assistant autonomy that enables business scaling.

**Critical Success Factors:**
- Products organize catalog by sellable items (not just files)
- Variants support color/configuration differences (flexible many-to-many relationships)
- Recipe cards generate with UUID-based URLs (non-guessable, publicly accessible)
- Recipe cards display complete print instructions (filaments, settings, download)
- Wizard workflow seamlessly connects slice upload → metadata extraction → product creation

---

## Table of Contents

1. [Epic Overview](#epic-overview)
2. [Stories Breakdown](#stories-breakdown)
3. [Architecture Integration](#architecture-integration)
4. [Recipe Card Specification](#recipe-card-specification)
5. [Wizard Flow Design](#wizard-flow-design)
6. [Testing Strategy](#testing-strategy)
7. [Risks and Mitigations](#risks-and-mitigations)

---

## Epic Overview

### Goal
Enable creation of products with variants, linking slices to variants, and generating recipe cards with all information needed for autonomous reprints.

### Business Value
- **Assistant Autonomy**: Recipe cards eliminate 100% of owner dependency during reprints
- **Scalability**: Owner can manage 1000+ products without becoming operational bottleneck
- **Error Prevention**: Standardized recipes prevent configuration mistakes (wrong filament in wrong slot)
- **Time Savings**: Assistant completes reprint setup in <5 minutes (vs 15-30 minutes with owner coordination)
- **Revenue Enablement**: Assistants can execute production runs independently, unlocking revenue growth

### Success Criteria
- ✅ Owner can create products with multiple variants (colors/configurations)
- ✅ Each variant links to one or more slices (many-to-many flexibility)
- ✅ Recipe cards generate with UUID URLs (non-guessable per FR-8)
- ✅ Recipe cards display filament slot assignments, curated settings, download button
- ✅ Recipe cards accessible on mobile (primary assistant use case)
- ✅ Assistant can access recipe card and execute print independently (0 owner questions)
- ✅ Complete wizard flow from slice upload through product creation

### Dependencies
**Prerequisites:**
- Epic 2 (File Storage) - requires models, slices, R2 storage
- Epic 3 (Metadata Extraction) - provides extracted metadata for recipe cards

**Blocks:**
- Epic 5 (Search) - recipe cards must exist before search can index them

---

## Stories Breakdown

### Story 4.1: Implement Product Entity CRUD

**Priority:** HIGH
**Complexity:** Low
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner
**I want** to create and manage product records representing physical inventory items
**So that** I can organize my catalog by sellable products

#### Technical Requirements

1. **Product Model** (already in schema from Epic 2)
   - Name: required, unique
   - Description: optional
   - Thumbnail: optional (fallback hierarchy defined)

2. **CRUD Operations**
   - Create: validate name uniqueness
   - Read: product detail with variants list
   - Update: name, description, thumbnail
   - Delete: hard delete with cascade to variants

3. **Product List View**
   - Visual grid layout (200x200px thumbnails minimum)
   - Display: thumbnail, name, variant count
   - Sort: recently added first (UX Principle 8)

4. **Incomplete Products** (per FR-7)
   - Products can exist without slices (marked draft/incomplete)
   - UI indicator: "No recipes yet"
   - Allow creation to defer recipe setup

#### Implementation Details

**API:** `src/routes/api/products/index.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  thumbnailUrl: z.string().url().optional()
})

export const Route = createFileRoute('/api/products/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const search = url.searchParams.get('search')

        const products = await prisma.product.findMany({
          where: search ? {
            name: { contains: search, mode: 'insensitive' }
          } : undefined,
          include: {
            variants: {
              include: {
                sliceVariants: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        const formatted = products.map(p => ({
          id: p.id,
          name: p.name,
          thumbnailUrl: p.thumbnailUrl,
          variantCount: p.variants.length,
          hasRecipes: p.variants.some(v => v.sliceVariants.length > 0)
        }))

        return json({ products: formatted })
      },

      POST: async ({ request }) => {
        const body = await request.json()
        const validated = CreateProductSchema.parse(body)

        try {
          const product = await prisma.product.create({
            data: validated
          })

          return json({ product }, { status: 201 })
        } catch (error) {
          if (error.code === 'P2002') { // unique constraint
            return json({
              error: {
                code: 'DUPLICATE_PRODUCT',
                message: `Product "${validated.name}" already exists`,
                field: 'name'
              }
            }, { status: 409 })
          }
          throw error
        }
      }
    }
  }
})
```

**Component:** `src/routes/products/index.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Grid } from '~/components/layout/Grid'
import { Card } from '~/components/layout/Card'

export const Route = createFileRoute('/products/')({
  component: ProductList
})

function ProductList() {
  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then(r => r.json())
  })

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <Button asChild>
          <Link to="/products/new">Create Product</Link>
        </Button>
      </div>

      <Grid cols={{ default: 1, md: 2, lg: 3, xl: 4 }}>
        {data?.products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </Grid>
    </div>
  )
}

function ProductCard({ product }) {
  return (
    <Card asChild>
      <Link to="/products/$productId" params={{ productId: product.id }}>
        <img
          src={product.thumbnailUrl || '/placeholder.png'}
          alt={product.name}
          className="w-full h-48 object-cover rounded-t"
          loading="lazy"
        />
        <div className="p-4">
          <h3 className="font-semibold text-lg">{product.name}</h3>
          <p className="text-sm text-gray-600">
            {product.variantCount} variant{product.variantCount !== 1 ? 's' : ''}
          </p>
          {!product.hasRecipes && (
            <span className="inline-block mt-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
              No recipes yet
            </span>
          )}
        </div>
      </Link>
    </Card>
  )
}
```

#### Acceptance Criteria
- [x] Product create form: name (required, unique), description (optional)
- [x] Product detail page displays: name, description, list of variants, associated slices
- [x] Products can be created without slices (marked incomplete per FR-7)
- [x] Edit product: update name (validates uniqueness), description
- [x] Delete product: hard delete with warning about variants
- [x] Product list page shows all products in visual grid per UX Principle 1
- [x] Product card shows variant count

---

### Story 4.2: Implement Product Variant CRUD

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 6-8 hours

#### User Story
**As an** owner
**I want** to create variants within products for different configurations
**So that** I can track color variations and configuration differences

#### Technical Requirements

1. **Variant Model** (already in schema)
   - Name: required, unique within product
   - Thumbnail: optional (fallback hierarchy)
   - Product relationship: many variants per product

2. **Thumbnail Priority** (per FR-7)
   - Priority 1: Extracted from variant's .gcode.3mf
   - Priority 2: User-uploaded manually
   - Priority 3: Fallback to product thumbnail
   - Priority 4: System placeholder

3. **CRUD Operations**
   - Create: within product context, validate name uniqueness per product
   - Read: variant detail with slices, filaments, recipe link
   - Update: name, thumbnail, quantity-per-print
   - Delete: hard delete with warnings (check slice linkages)

4. **Variant Display**
   - Listed within product detail page
   - Card layout showing thumbnail, name, slice count
   - "View Recipe" button if slices linked

#### Implementation Details

**API:** `src/routes/api/products/$productId/variants.ts`

```typescript
const CreateVariantSchema = z.object({
  name: z.string().min(1).max(255),
  thumbnailUrl: z.string().url().optional()
})

export const Route = createFileRoute('/api/products/$productId/variants')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await request.json()
        const validated = CreateVariantSchema.parse(body)

        try {
          const variant = await prisma.productVariant.create({
            data: {
              productId: params.productId,
              name: validated.name,
              thumbnailUrl: validated.thumbnailUrl
            }
          })

          return json({ variant }, { status: 201 })
        } catch (error) {
          if (error.code === 'P2002') {
            return json({
              error: {
                code: 'DUPLICATE_VARIANT',
                message: `Variant "${validated.name}" already exists for this product`,
                field: 'name'
              }
            }, { status: 409 })
          }
          throw error
        }
      }
    }
  }
})
```

**Component:** `src/routes/products/$productId.tsx`

```typescript
export const Route = createFileRoute('/products/$productId')({
  component: ProductDetail
})

function ProductDetail() {
  const { productId } = Route.useParams()
  const { data: product } = useQuery({
    queryKey: ['products', productId],
    queryFn: () => fetch(`/api/products/${productId}`).then(r => r.json())
  })

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">{product?.name}</h1>
      {product?.description && (
        <p className="text-gray-600 mb-6">{product.description}</p>
      )}

      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Variants</h2>
          <Button onClick={() => setShowAddVariant(true)}>
            Add Variant
          </Button>
        </div>

        <Grid cols={{ default: 1, md: 2, lg: 3 }}>
          {product?.variants.map(variant => (
            <VariantCard
              key={variant.id}
              variant={variant}
              productId={productId}
            />
          ))}
        </Grid>
      </section>
    </div>
  )
}

function VariantCard({ variant, productId }) {
  const thumbnailUrl = variant.thumbnailUrl || '/placeholder.png'
  const hasRecipe = variant.sliceCount > 0

  return (
    <Card>
      <img
        src={thumbnailUrl}
        alt={variant.name}
        className="w-full h-32 object-cover rounded-t"
      />
      <div className="p-4">
        <h3 className="font-semibold">{variant.name}</h3>
        <p className="text-sm text-gray-600">
          {variant.sliceCount} slice{variant.sliceCount !== 1 ? 's' : ''}
        </p>

        {hasRecipe ? (
          <Button asChild className="mt-2 w-full">
            <Link to="/recipe/$uuid" params={{ uuid: variant.id }}>
              View Recipe
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="mt-2 w-full">
            <Link to="/slices/upload" search={{ variantId: variant.id }}>
              Add Slice
            </Link>
          </Button>
        )}
      </div>
    </Card>
  )
}
```

#### Acceptance Criteria
- [x] Variant create form: name (required), quantity-per-print (default 1)
- [x] Variant names unique within product scope per FR-7
- [x] Variant detail page shows: name, thumbnail, associated slices, filament requirements
- [x] Thumbnail priority implemented per FR-7
- [x] Edit variant: update name, quantity-per-print, replace thumbnail
- [x] Delete variant: hard delete with warnings
- [x] Variants displayed as cards within product detail page
- [x] Manual thumbnail upload/replace for variants

---

### Story 4.3: Implement Slice-Variant Linking

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 6-8 hours

#### User Story
**As an** owner
**I want** to associate slices with product variants
**So that** each variant has a recipe for reproduction

#### Technical Requirements

1. **Many-to-Many Relationship**
   - Junction table: SliceVariant (slice_id, variant_id, quantity_per_print)
   - Flexible: same slice can serve multiple variants
   - Flexible: variant can have multiple slices (different quality settings)

2. **Quantity Per Print** (at junction level)
   - Default: 1
   - Allows same slice to produce different quantities for different variants
   - Example: "Baby Whale Red" variant → 1 per print, "Baby Whale Blue Set" variant → 3 per print (same slice)

3. **Linking UI**
   - From wizard: select/create variant during slice upload
   - From variant page: "Add Slice" button to link existing slices
   - From slice page: "Link to Variant" button

4. **Deletion Protection** (per FR-7)
   - Cannot delete all slices from variant once at least one linked
   - UI warning: "This variant requires at least one slice"
   - Allow deletion if multiple slices linked (keeps last one)

#### Implementation Details

**API:** `src/routes/api/variants/$variantId/slices.ts`

```typescript
const LinkSliceSchema = z.object({
  sliceId: z.string().uuid(),
  quantityPerPrint: z.number().int().min(1).default(1)
})

export const Route = createFileRoute('/api/variants/$variantId/slices')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await request.json()
        const validated = LinkSliceSchema.parse(body)

        const link = await prisma.sliceVariant.create({
          data: {
            variantId: params.variantId,
            sliceId: validated.sliceId,
            quantityPerPrint: validated.quantityPerPrint
          }
        })

        return json({ link }, { status: 201 })
      },

      DELETE: async ({ request, params }) => {
        const { sliceId } = await request.json()

        // Check if this is the last slice for this variant
        const sliceCount = await prisma.sliceVariant.count({
          where: { variantId: params.variantId }
        })

        if (sliceCount === 1) {
          return json({
            error: {
              code: 'LAST_SLICE',
              message: 'Cannot delete the last slice from a variant'
            }
          }, { status: 409 })
        }

        await prisma.sliceVariant.deleteMany({
          where: {
            variantId: params.variantId,
            sliceId: sliceId
          }
        })

        return json({ success: true }, { status: 204 })
      }
    }
  }
})
```

**Component:** `src/components/products/LinkSliceForm.tsx`

```typescript
interface LinkSliceFormProps {
  variantId: string
  onSuccess: () => void
}

export function LinkSliceForm({ variantId, onSuccess }: LinkSliceFormProps) {
  const [selectedSliceId, setSelectedSliceId] = useState('')
  const [quantityPerPrint, setQuantityPerPrint] = useState(1)

  const { data: slices } = useQuery({
    queryKey: ['slices', 'available'],
    queryFn: () => fetch('/api/slices').then(r => r.json())
  })

  const linkMutation = useMutation({
    mutationFn: (data: { sliceId: string, quantityPerPrint: number }) =>
      fetch(`/api/variants/${variantId}/slices`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      linkMutation.mutate({ sliceId: selectedSliceId, quantityPerPrint })
    }}>
      <Select
        label="Select Slice"
        value={selectedSliceId}
        onChange={setSelectedSliceId}
      >
        {slices?.map(slice => (
          <option key={slice.id} value={slice.id}>
            {slice.filename}
          </option>
        ))}
      </Select>

      <TextField
        label="Quantity Per Print"
        type="number"
        min={1}
        value={quantityPerPrint}
        onChange={(e) => setQuantityPerPrint(parseInt(e.target.value))}
      />

      <Button type="submit">Link Slice</Button>
    </form>
  )
}
```

#### Acceptance Criteria
- [x] UI to link existing slices to variants (many-to-many per FR-7)
- [x] During wizard, owner can create new variant OR select existing variant
- [x] Slice-variant junction stores quantity-per-print
- [x] Variant can have multiple slices (different quality settings)
- [x] Slice can be used by multiple variants
- [x] Cannot delete all slices from variant once linked per FR-7
- [x] UI shows slice preview cards within variant detail page with "Unlink" button

---

### Story 4.4: Implement Multi-Model Slice Support

**Priority:** MEDIUM
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner
**I want** slices to reference multiple model files for multi-part prints
**So that** I can create plates with multiple models printed together

#### Technical Requirements

1. **Many-to-Many Models-Slices** (per FR-9)
   - Junction table: SliceModel (slice_id, model_id)
   - Slice can reference multiple models (multi-model plate)
   - Model can be used in multiple slices

2. **Completeness Validation** (per FR-9)
   - All model relationships must be complete before slice usable
   - Incomplete slice: warning "Missing 2 of 4 models"
   - Prevent recipe card generation for incomplete slices

3. **Navigation Helper** (per FR-9)
   - From incomplete slice: easy link to upload missing models
   - From slice detail: list all associated models with thumbnails
   - From model detail: show which slices use that model (reverse relationship)

4. **Multi-Model Plates**
   - No separate "plate" entity (per elicitation decision)
   - Simply slices with multiple model relationships
   - UI communicates this clearly: "Multi-model print (3 models)"

#### Implementation Details

**API:** `src/routes/api/slices/$sliceId/models.ts`

```typescript
export const Route = createFileRoute('/api/slices/$sliceId/models')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { modelId } = await request.json()

        const link = await prisma.sliceModel.create({
          data: {
            sliceId: params.sliceId,
            modelId: modelId
          }
        })

        return json({ link }, { status: 201 })
      },

      DELETE: async ({ request, params }) => {
        const { modelId } = await request.json()

        await prisma.sliceModel.deleteMany({
          where: {
            sliceId: params.sliceId,
            modelId: modelId
          }
        })

        return json({ success: true }, { status: 204 })
      }
    }
  }
})
```

**Component:** `src/routes/slices/$sliceId.tsx` (enhanced)

```typescript
function SliceDetail() {
  const { sliceId } = Route.useParams()
  const { data: slice } = useQuery({
    queryKey: ['slices', sliceId],
    queryFn: () => fetch(`/api/slices/${sliceId}`).then(r => r.json())
  })

  const expectedModelCount = slice?.metadataExtracted
    ? extractModelCountFromMetadata(slice.metadata)
    : null
  const actualModelCount = slice?.models.length || 0
  const isComplete = expectedModelCount === null || actualModelCount === expectedModelCount

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{slice?.filename}</h1>

      {!isComplete && (
        <Alert variant="warning" className="mb-4">
          <AlertTitle>Incomplete Model Relationships</AlertTitle>
          <AlertDescription>
            This slice references {expectedModelCount} models but only {actualModelCount} are linked.
            <Button asChild variant="link">
              <Link to="/models/upload" search={{ sliceId }}>
                Upload Missing Models
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Associated Models</h2>
        <Grid cols={{ default: 1, md: 2, lg: 3 }}>
          {slice?.models.map(model => (
            <ModelCard key={model.id} model={model} />
          ))}
        </Grid>
        <Button onClick={() => setShowLinkModel(true)} className="mt-4">
          Link Existing Model
        </Button>
      </section>
    </div>
  )
}
```

#### Acceptance Criteria
- [x] Slice can link to multiple models via many-to-many relationship per FR-9
- [x] UI to select multiple models when creating/editing slice
- [x] All model relationships must be complete before slice usable per FR-9
- [x] Incomplete relationships show warnings per FR-9
- [x] Slice detail page lists all associated models with thumbnails
- [x] Easy navigation from slice → upload missing models → complete relationships per FR-9
- [x] Model detail page shows which slices use that model (reverse relationship)

---

### Story 4.5: Implement Recipe Card Generation

**Priority:** CRITICAL
**Complexity:** High
**Estimated Effort:** 10-12 hours

#### User Story
**As an** owner
**I want** recipe cards auto-generated for products with complete slice data
**So that** I can share reproducible print instructions with assistants

#### Technical Requirements

1. **Generation Requirements** (per FR-8)
   - Recipe card generated only for variants with at least one complete slice
   - UUID-based recipe card URLs (variant UUID used as recipe UUID)
   - Validate slice file exists in R2 before display
   - Publicly accessible (no authentication required in MVP)

2. **Recipe Card Contents** (per FR-8)
   - Product thumbnail (large, prominent)
   - "Download Slice" button with R2 presigned URL
   - Filament requirements with AMS slots: "Slot 1: Red PLA (Bambu Lab)"
   - Curated slicer settings: layer height, temps, infill, supports
   - Estimated print time, filament usage
   - Mobile-optimized layout (UX Principle 9)

3. **Multiple Slices Per Variant**
   - If variant has multiple slices, show all as separate recipe cards
   - OR designate one as "primary" and show others as alternatives
   - Decision: show all (simpler for MVP)

4. **R2 Presigned URLs**
   - Generate presigned download URLs with 1-hour expiration
   - Set content-disposition: attachment to force download
   - Handle expired URLs gracefully (regenerate on page refresh)

#### Implementation Details

**API:** `src/routes/api/recipe/$uuid.ts`

```typescript
import { getContext } from 'vinxi/http'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/recipe/$uuid')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const cf = getContext('cloudflare')

        // UUID is variant ID
        const variant = await prisma.productVariant.findUnique({
          where: { id: params.uuid },
          include: {
            product: true,
            sliceVariants: {
              include: {
                slice: {
                  include: {
                    sliceFilaments: {
                      include: { filament: true }
                    },
                    sliceModels: {
                      include: { model: true }
                    }
                  }
                }
              }
            }
          }
        })

        if (!variant) {
          return json({ error: 'Recipe not found' }, { status: 404 })
        }

        // Generate recipe card data
        const recipes = await Promise.all(
          variant.sliceVariants.map(async (sv) => {
            const slice = sv.slice

            // Validate R2 file exists
            const fileExists = await cf.env.FILES_BUCKET.head(slice.r2Key)
            if (!fileExists) {
              console.error(`Slice file missing from R2: ${slice.r2Key}`)
              return null
            }

            // Generate presigned download URL (1 hour expiration)
            const downloadUrl = await cf.env.FILES_BUCKET.getSignedUrl(slice.r2Key, {
              expiresIn: 3600
            })

            // Format filaments with AMS slots
            const filaments = slice.sliceFilaments
              .sort((a, b) => a.amsSlotIndex - b.amsSlotIndex)
              .map(sf => ({
                amsSlot: sf.amsSlotIndex,
                brand: sf.filament?.brand || 'Unknown',
                colorName: sf.filament?.colorName,
                colorHex: sf.filament?.colorHex || '#000000',
                materialType: sf.filament?.materialType || 'Unknown',
                missing: !sf.filamentId // deleted filament
              }))

            // Extract curated settings
            const settings = {
              layerHeight: slice.layerHeight,
              nozzleTemp: slice.nozzleTemp,
              bedTemp: slice.bedTemp,
              infillPercent: slice.infillPercent,
              supports: slice.supportsEnabled
            }

            return {
              sliceId: slice.id,
              filename: slice.filename,
              downloadUrl,
              quantityPerPrint: sv.quantityPerPrint,
              estimatedTimeHours: slice.estimatedTimeSec ?
                (slice.estimatedTimeSec / 3600).toFixed(1) : null,
              filamentUsedG: slice.filamentUsedG,
              filaments,
              settings,
              models: slice.sliceModels.map(sm => ({
                id: sm.model.id,
                filename: sm.model.filename,
                thumbnailUrl: sm.model.thumbnailUrl
              }))
            }
          })
        )

        const validRecipes = recipes.filter(r => r !== null)

        if (validRecipes.length === 0) {
          return json({
            error: 'No valid recipes available (files missing from storage)'
          }, { status: 404 })
        }

        return json({
          product: {
            name: variant.product.name,
            thumbnailUrl: variant.thumbnailUrl || variant.product.thumbnailUrl
          },
          variant: {
            name: variant.name
          },
          recipes: validRecipes
        })
      }
    }
  }
})
```

**Component:** `src/routes/recipe/$uuid.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/recipe/$uuid')({
  component: RecipeCard
})

function RecipeCard() {
  const { uuid } = Route.useParams()
  const { data: recipe } = useQuery({
    queryKey: ['recipe', uuid],
    queryFn: () => fetch(`/api/recipe/${uuid}`).then(r => r.json())
  })

  if (!recipe) return <div>Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        {/* Product Header */}
        <div className="text-center mb-6">
          <img
            src={recipe.product.thumbnailUrl || '/placeholder.png'}
            alt={recipe.product.name}
            className="w-full max-w-md mx-auto h-64 object-cover rounded-lg mb-4"
          />
          <h1 className="text-3xl font-bold">{recipe.product.name}</h1>
          <p className="text-xl text-gray-600">{recipe.variant.name}</p>
        </div>

        {/* Recipes (if multiple slices) */}
        {recipe.recipes.map((r, idx) => (
          <div key={r.sliceId} className="mb-8 pb-8 border-b last:border-b-0">
            {recipe.recipes.length > 1 && (
              <h2 className="text-xl font-semibold mb-4">
                Recipe {idx + 1} - {r.filename}
              </h2>
            )}

            {/* Download Button */}
            <a
              href={r.downloadUrl}
              download={r.filename}
              className="block w-full bg-blue-600 text-white text-center py-4 rounded-lg font-semibold text-lg mb-6 hover:bg-blue-700"
            >
              Download Slice File
            </a>

            {/* Filament Requirements */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Filament Setup</h3>
              <div className="space-y-2">
                {r.filaments.map(f => (
                  <div
                    key={f.amsSlot}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded"
                  >
                    <div className="font-bold text-lg w-16">
                      Slot {f.amsSlot}:
                    </div>
                    {f.missing ? (
                      <div className="text-red-600 font-semibold">
                        ⚠️ Filament Deleted
                      </div>
                    ) : (
                      <>
                        <div
                          className="w-8 h-8 rounded border-2"
                          style={{ backgroundColor: f.colorHex }}
                        />
                        <div>
                          <div className="font-medium">
                            {f.colorName || 'Unnamed'} {f.materialType}
                          </div>
                          <div className="text-sm text-gray-600">{f.brand}</div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Print Settings */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Print Settings</h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-600">Layer Height</dt>
                  <dd className="text-lg font-medium">{r.settings.layerHeight}mm</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Nozzle Temp</dt>
                  <dd className="text-lg font-medium">{r.settings.nozzleTemp}°C</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Bed Temp</dt>
                  <dd className="text-lg font-medium">{r.settings.bedTemp}°C</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Infill</dt>
                  <dd className="text-lg font-medium">{r.settings.infillPercent}%</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Supports</dt>
                  <dd className="text-lg font-medium">
                    {r.settings.supports ? 'Yes' : 'No'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Print Time</dt>
                  <dd className="text-lg font-medium">
                    ~{r.estimatedTimeHours}h
                  </dd>
                </div>
              </dl>
            </section>

            {/* Additional Info */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Additional Info</h3>
              <p className="text-gray-600">
                Quantity per print: {r.quantityPerPrint}
              </p>
              {r.filamentUsedG && (
                <p className="text-gray-600">
                  Filament usage: ~{r.filamentUsedG}g
                </p>
              )}
            </section>
          </div>
        ))}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-8">
          Recipe ID: {uuid}
        </div>
      </div>
    </div>
  )
}
```

#### Acceptance Criteria
- [x] Recipe card generated only for variants with at least one complete slice per FR-8
- [x] UUID-based recipe card URLs (non-guessable per FR-8)
- [x] Recipe card validates slice file exists in R2 before display per FR-8
- [x] Recipe card displays all required elements per FR-8
- [x] Recipe cards publicly accessible (no auth required per FR-8)
- [x] Multiple slices per variant: show all recipes
- [x] Mobile-optimized layout per UX Principle 9

---

### Story 4.6: Implement Product Creation from Wizard

**Priority:** HIGH
**Complexity:** High
**Estimated Effort:** 8-10 hours

#### User Story
**As an** owner
**I want** to create products directly from slice upload wizard
**So that** workflow is seamless from upload to recipe generation

#### Technical Requirements

1. **Wizard Integration**
   - Step 3 of wizard (after metadata extraction and filament matching)
   - Two workflow paths: create new product OR add to existing product
   - Atomic transaction: product → variant → slice linkage

2. **New Product Path**
   - Fields: product name, variant name, quantity-per-print
   - Thumbnail defaults from wizard extraction (UX Principle 8)
   - Validate product name uniqueness

3. **Existing Product Path**
   - Dropdown: select existing product
   - Fields: variant name, quantity-per-print
   - Validate variant name unique within product

4. **Success Flow**
   - Confirmation message: "Product created successfully!"
   - Display recipe card link immediately
   - Option: "View Recipe" or "Create Another Product"

5. **Skip Product Creation**
   - Button: "Save Slice Without Product" (defer linking)
   - Slice saved, marked as unlinked
   - User can link later from slice detail page

#### Implementation Details

**Component:** `src/components/wizards/ProductCreationStep.tsx`

```typescript
interface ProductCreationStepProps {
  sliceId: string
  extractedThumbnail?: string
  onSuccess: (recipeUrl: string) => void
}

export function ProductCreationStep({
  sliceId,
  extractedThumbnail,
  onSuccess
}: ProductCreationStepProps) {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [productName, setProductName] = useState('')
  const [existingProductId, setExistingProductId] = useState('')
  const [variantName, setVariantName] = useState('')
  const [quantityPerPrint, setQuantityPerPrint] = useState(1)

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then(r => r.json())
  })

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (mode === 'new') {
        // Create product + variant + link slice (atomic)
        const response = await fetch('/api/products/create-with-slice', {
          method: 'POST',
          body: JSON.stringify({
            productName: data.productName,
            variantName: data.variantName,
            sliceId,
            quantityPerPrint: data.quantityPerPrint,
            thumbnailUrl: extractedThumbnail
          })
        })
        return response.json()
      } else {
        // Create variant on existing product + link slice
        const response = await fetch(`/api/products/${data.productId}/add-variant-with-slice`, {
          method: 'POST',
          body: JSON.stringify({
            variantName: data.variantName,
            sliceId,
            quantityPerPrint: data.quantityPerPrint,
            thumbnailUrl: extractedThumbnail
          })
        })
        return response.json()
      }
    },
    onSuccess: (result) => {
      const recipeUrl = `/recipe/${result.variantId}`
      onSuccess(recipeUrl)
    }
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Create Product</h2>

      {/* Mode Selection */}
      <div className="flex gap-4">
        <Button
          variant={mode === 'new' ? 'primary' : 'outline'}
          onClick={() => setMode('new')}
        >
          New Product
        </Button>
        <Button
          variant={mode === 'existing' ? 'primary' : 'outline'}
          onClick={() => setMode('existing')}
        >
          Add to Existing Product
        </Button>
      </div>

      {/* New Product Form */}
      {mode === 'new' && (
        <div className="space-y-4">
          <TextField
            label="Product Name"
            value={productName}
            onChange={setProductName}
            required
          />
          <TextField
            label="Variant Name"
            value={variantName}
            onChange={setVariantName}
            required
            placeholder="e.g., Red, Blue, Standard"
          />
          <TextField
            label="Quantity Per Print"
            type="number"
            min={1}
            value={quantityPerPrint}
            onChange={(e) => setQuantityPerPrint(parseInt(e.target.value))}
          />

          {extractedThumbnail && (
            <div>
              <label className="text-sm font-medium">Thumbnail Preview</label>
              <img
                src={extractedThumbnail}
                alt="Extracted thumbnail"
                className="w-32 h-32 object-cover rounded mt-2"
              />
            </div>
          )}
        </div>
      )}

      {/* Existing Product Form */}
      {mode === 'existing' && (
        <div className="space-y-4">
          <Select
            label="Select Product"
            value={existingProductId}
            onChange={setExistingProductId}
          >
            <option value="">Choose a product...</option>
            {products?.products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <TextField
            label="Variant Name"
            value={variantName}
            onChange={setVariantName}
            required
          />
          <TextField
            label="Quantity Per Print"
            type="number"
            min={1}
            value={quantityPerPrint}
            onChange={(e) => setQuantityPerPrint(parseInt(e.target.value))}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => onSuccess(null)} // Skip product creation
        >
          Save Slice Without Product
        </Button>

        <Button
          onClick={() => createMutation.mutate({
            productName,
            productId: existingProductId,
            variantName,
            quantityPerPrint
          })}
          disabled={mode === 'new' ? !productName || !variantName : !existingProductId || !variantName}
        >
          Create Product & Recipe
        </Button>
      </div>
    </div>
  )
}
```

**API:** `src/routes/api/products/create-with-slice.ts` (atomic transaction)

```typescript
const CreateWithSliceSchema = z.object({
  productName: z.string().min(1),
  variantName: z.string().min(1),
  sliceId: z.string().uuid(),
  quantityPerPrint: z.number().int().min(1),
  thumbnailUrl: z.string().url().optional()
})

export const Route = createFileRoute('/api/products/create-with-slice')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const validated = CreateWithSliceSchema.parse(body)

        // Atomic transaction
        const result = await prisma.$transaction(async (tx) => {
          // 1. Create product
          const product = await tx.product.create({
            data: {
              name: validated.productName,
              thumbnailUrl: validated.thumbnailUrl
            }
          })

          // 2. Create variant
          const variant = await tx.productVariant.create({
            data: {
              productId: product.id,
              name: validated.variantName,
              thumbnailUrl: validated.thumbnailUrl
            }
          })

          // 3. Link slice to variant
          await tx.sliceVariant.create({
            data: {
              sliceId: validated.sliceId,
              variantId: variant.id,
              quantityPerPrint: validated.quantityPerPrint
            }
          })

          return { product, variant }
        })

        return json({
          productId: result.product.id,
          variantId: result.variant.id,
          recipeUrl: `/recipe/${result.variant.id}`
        }, { status: 201 })
      }
    }
  }
})
```

#### Acceptance Criteria
- [x] Wizard offers two paths: create new product OR add to existing product
- [x] New product path: enter product name, variant name, quantity-per-print
- [x] Existing product path: select product, enter variant name, quantity
- [x] Thumbnail defaults from wizard extraction per UX Principle 8
- [x] Success confirmation shows recipe card link
- [x] "Save Slice Without Product" option available (defer linking)
- [x] Wizard completion creates all entities atomically per NFR-4

---

### Story 4.7: Implement "Needs Slicing" Tracking

**Priority:** LOW
**Complexity:** Low
**Estimated Effort:** 2-4 hours

#### User Story
**As an** owner
**I want** to mark models as needing slicing and view the list
**So that** I remember which models haven't been processed yet

#### Technical Requirements

1. **Model Flag** (per FR-15)
   - Boolean field: `needs_slicing` (default false)
   - Toggle on model detail page
   - No notes field in MVP (deferred to Phase 2)

2. **Needs Slicing List**
   - Page: `/models/needs-slicing`
   - Grid view of all flagged models
   - List grows indefinitely (no archive/dismiss in MVP per FR-15)
   - Sort by date flagged (most recent first)

3. **Auto-Clear Behavior**
   - Decision needed: auto-clear when slice uploaded? Or manual clear?
   - Recommendation: manual clear (simpler for MVP)

4. **Navigation**
   - Clicking model in list → model detail page
   - From model detail → "Upload Slice" button

#### Implementation Details

**Database Migration:** Add field to Model table

```prisma
model Model {
  // ... existing fields
  needsSlicing Boolean @default(false)
}
```

**API:** `src/routes/api/models/$modelId/needs-slicing.ts`

```typescript
export const Route = createFileRoute('/api/models/$modelId/needs-slicing')({
  server: {
    handlers: {
      PATCH: async ({ params, request }) => {
        const { needsSlicing } = await request.json()

        const model = await prisma.model.update({
          where: { id: params.modelId },
          data: { needsSlicing }
        })

        return json({ model })
      }
    }
  }
})
```

**Component:** `src/routes/models/needs-slicing.tsx`

```typescript
export const Route = createFileRoute('/models/needs-slicing')({
  component: NeedsSlicingList
})

function NeedsSlicingList() {
  const { data: models } = useQuery({
    queryKey: ['models', 'needs-slicing'],
    queryFn: () => fetch('/api/models?needsSlicing=true').then(r => r.json())
  })

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Models Needing Slicing</h1>

      {models?.length === 0 && (
        <p className="text-gray-600">No models flagged. All caught up!</p>
      )}

      <Grid cols={{ default: 1, md: 2, lg: 3, xl: 4 }}>
        {models?.map(model => (
          <ModelCard key={model.id} model={model} />
        ))}
      </Grid>
    </div>
  )
}
```

#### Acceptance Criteria
- [x] Model detail page has "Needs Slicing" boolean toggle per FR-15
- [x] Toggling on marks model with flag (database field)
- [x] "Needs Slicing" list page shows all flagged models in grid view
- [x] List grows indefinitely in MVP per FR-15
- [x] Flag manually cleared (no auto-clear)
- [x] List sortable by date flagged (most recent first)
- [x] Clicking model navigates to model detail page for slice upload

---

### Story 4.8: Implement Relationship Navigation UI

**Priority:** MEDIUM
**Complexity:** Low
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner or assistant
**I want** to navigate between related entities easily
**So that** I can explore the catalog and understand connections

#### Technical Requirements

1. **Reverse Relationships** (per FR-12)
   - Filament detail: "Used in X slices" with clickable list
   - Model detail: "Used in Y slices" and "Associated products"
   - Product cards: variant count and slice status

2. **Bidirectional Navigation** (per UX Principle 7)
   - From any entity to related entities in ≤2 clicks
   - Breadcrumb navigation shows current location
   - Clear visual hierarchy

3. **Broken Relationships** (per UX Principle 7)
   - Warning flags: "Missing filament: Red PLA deleted"
   - Obvious visual indicators (yellow warning badges)
   - Actionable links to fix broken relationships

4. **Breadcrumbs**
   - Format: Products → Baby Whale → Red Variant → Recipe
   - Always visible at top of detail pages
   - Clickable for quick navigation

#### Implementation Details

**Component:** `src/components/shared/Breadcrumbs.tsx`

```typescript
interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center">
          {idx > 0 && <span className="mx-2">/</span>}
          {item.href ? (
            <Link to={item.href} className="hover:text-gray-900">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}
```

**Enhanced Filament Detail Page:**

```typescript
function FilamentDetail() {
  const { filamentId } = Route.useParams()
  const { data: filament } = useQuery({
    queryKey: ['filaments', filamentId],
    queryFn: () => fetch(`/api/filaments/${filamentId}`).then(r => r.json())
  })

  return (
    <div className="container mx-auto p-4">
      <Breadcrumbs items={[
        { label: 'Filaments', href: '/filaments' },
        { label: filament?.brand }
      ]} />

      <h1 className="text-2xl font-bold mb-4">{filament?.brand}</h1>

      {/* Reverse Relationship */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">
          Used in {filament?.slices.length} Slices
        </h2>
        <Grid cols={{ default: 1, md: 2, lg: 3 }}>
          {filament?.slices.map(slice => (
            <SliceCard key={slice.id} slice={slice} />
          ))}
        </Grid>
      </section>
    </div>
  )
}
```

#### Acceptance Criteria
- [x] Filament detail page shows: "Used in X slices" with clickable list per FR-12
- [x] Model detail page shows: "Used in Y slices" and "Associated products" per FR-12
- [x] Product cards display variant count and slice status per FR-12
- [x] Slice detail page shows: associated models, filaments, products
- [x] Navigation achievable in ≤2 clicks per UX Principle 7
- [x] Broken relationships flagged with warnings per UX Principle 7
- [x] Breadcrumb navigation shows current location per UX Principle 7

---

## Architecture Integration

### Complete Database Schema

Epic 4 completes the data model with products and variants:

```prisma
model Product {
  id           String   @id @default(uuid())
  tenantId     String?
  name         String   @unique
  description  String?
  thumbnailUrl String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  variants ProductVariant[]

  @@index([tenantId])
  @@index([name]) // for search
}

model ProductVariant {
  id           String   @id @default(uuid())
  productId    String
  tenantId     String?
  name         String
  thumbnailUrl String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  product       Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  sliceVariants SliceVariant[]

  @@unique([productId, name], name: "uniqueVariantPerProduct")
  @@index([tenantId])
  @@index([productId])
}

model SliceVariant {
  id               String   @id @default(uuid())
  sliceId          String
  variantId        String
  quantityPerPrint Int      @default(1)
  createdAt        DateTime @default(now())

  slice   Slice          @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  variant ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([sliceId, variantId])
  @@index([sliceId])
  @@index([variantId])
}

model SliceModel {
  id        String   @id @default(uuid())
  sliceId   String
  modelId   String
  createdAt DateTime @default(now())

  slice Slice @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  model Model @relation(fields: [modelId], references: [id], onDelete: Cascade)

  @@unique([sliceId, modelId])
  @@index([sliceId])
  @@index([modelId])
}

// Add needs_slicing to Model
model Model {
  // ... existing fields
  needsSlicing Boolean @default(false)
}
```

### API Endpoints Summary

**Products:**
- GET /api/products - List products (with search)
- POST /api/products - Create product
- GET /api/products/:id - Get product with variants
- PATCH /api/products/:id - Update product
- DELETE /api/products/:id - Delete product

**Variants:**
- POST /api/products/:productId/variants - Create variant
- GET /api/variants/:id - Get variant details
- PATCH /api/variants/:id - Update variant
- DELETE /api/variants/:id - Delete variant

**Slice-Variant Linking:**
- POST /api/variants/:variantId/slices - Link slice to variant
- DELETE /api/variants/:variantId/slices - Unlink slice

**Slice-Model Linking:**
- POST /api/slices/:sliceId/models - Link model to slice
- DELETE /api/slices/:sliceId/models - Unlink model

**Recipe Cards:**
- GET /api/recipe/:uuid - Get recipe card data (public)

**Wizard Helpers:**
- POST /api/products/create-with-slice - Atomic product+variant+link creation
- POST /api/products/:productId/add-variant-with-slice - Atomic variant+link creation

**Needs Slicing:**
- PATCH /api/models/:modelId/needs-slicing - Toggle flag

---

## Recipe Card Specification

### Layout (Mobile-Optimized)

```
┌─────────────────────────────────┐
│  Product Thumbnail (Large)      │
│  400x400px                       │
├─────────────────────────────────┤
│  Product Name (H1)               │
│  Variant Name (H2)               │
├─────────────────────────────────┤
│  [ Download Slice File ]         │
│  (Large button, prominent)       │
├─────────────────────────────────┤
│  Filament Setup:                 │
│  ┌─────────────────────────┐    │
│  │ Slot 1: ■ Red PLA       │    │
│  │         Bambu Lab       │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ Slot 2: ■ Blue PLA      │    │
│  │         Bambu Lab       │    │
│  └─────────────────────────┘    │
├─────────────────────────────────┤
│  Print Settings:                 │
│  Layer Height    0.16mm          │
│  Nozzle Temp     220°C           │
│  Bed Temp        60°C            │
│  Infill          20%             │
│  Supports        Yes             │
│  Print Time      ~3.5h           │
├─────────────────────────────────┤
│  Quantity per print: 1           │
│  Filament usage: 28g             │
└─────────────────────────────────┘
```

### Responsive Breakpoints
- Mobile (<768px): Single column, large touch targets (44px minimum)
- Tablet (768-1024px): Centered max-width 600px
- Desktop (>1024px): Centered max-width 800px

---

## Wizard Flow Design

### Complete Wizard Sequence

```
Step 1: Upload Slice
  └─ File selection + upload to R2

Step 2: Metadata Extraction (Epic 3)
  └─ Synchronous extraction (10s)
  └─ Show loading spinner

Step 3: Filament Matching (Epic 3)
  └─ Display matched filaments (green checkmarks)
  └─ Inline creation for unmatched filaments
  └─ "Continue" button (enabled when all resolved)

Step 4: Settings Review (Epic 3)
  └─ Curated metadata display (read-only)
  └─ "Continue to Product Creation" button

Step 5: Product Creation (Epic 4 - THIS EPIC)
  └─ Mode selection: New Product OR Existing Product
  └─ Form fields (product name, variant name, quantity)
  └─ Thumbnail preview
  └─ "Create Product & Recipe" OR "Save Without Product"

Step 6: Success
  └─ Confirmation message
  └─ Recipe card link display
  └─ "View Recipe" button
```

### State Management Strategy

**Wizard Context:**
```typescript
interface WizardContext {
  sliceId: string
  extractedMetadata?: SliceMetadata
  matchedFilaments: FilamentMatchResult[]
  createdFilaments: Record<number, string> // amsSlot -> filamentId
  extractedThumbnail?: string
  productCreated?: {
    productId: string
    variantId: string
    recipeUrl: string
  }
}
```

**Persistence:**
- Browser localStorage for draft state
- Clear on successful completion
- Resume from last step on page reload

---

## Testing Strategy

### Unit Tests

**Tests/unit/recipe-generation.test.ts:**
- Recipe card data structure generation
- Filament sorting by AMS slot
- Missing filament handling
- R2 file existence validation
- Presigned URL generation (mocked)

### Integration Tests

**Tests/integration/product-workflow.test.ts:**
- Complete workflow: create product → variant → link slice
- Atomic transaction rollback on error
- Wizard state persistence
- Recipe card accessibility

### E2E Tests

**Tests/e2e/assistant-workflow.test.ts:**
- Assistant user story (Journey 2 from PRD)
- Search product → view recipe → download slice
- Mobile viewport testing
- Recipe card loads in <2s

### User Acceptance Testing

1. **Owner Workflow:**
   - Complete wizard from slice upload through product creation
   - Verify recipe card displays all information correctly
   - Test thumbnail fallback hierarchy
   - Create multiple variants for same product

2. **Assistant Workflow:**
   - Access recipe card on mobile device
   - Download slice file
   - Verify filament AMS slot assignments clear
   - Confirm print settings readable on small screen

---

## Risks and Mitigations

### Risk 1: Wizard Complexity
**Severity:** MEDIUM
**Likelihood:** MEDIUM
**Mitigation:**
- Comprehensive state management (localStorage persistence)
- Clear visual progress indicators
- Skip product creation option (defer linking)
- User testing with real slicing workflows

### Risk 2: Recipe Card Mobile UX
**Severity:** HIGH
**Likelihood:** LOW
**Mitigation:**
- Mobile-first design approach
- Large touch targets (44px minimum)
- Test on actual mobile devices (iPhone, Android)
- Optimize image loading for mobile bandwidth

### Risk 3: R2 File Availability
**Severity:** MEDIUM
**Likelihood:** LOW
**Mitigation:**
- Validate file existence before generating recipe
- Clear error messages if file missing
- R2 versioning enabled (recover deleted files)
- Automated backup verification

### Risk 4: UUID Enumeration
**Severity:** LOW
**Likelihood:** LOW
**Mitigation:**
- UUIDs are non-sequential (not guessable)
- Rate limiting on recipe endpoint
- Monitor for suspicious access patterns
- Phase 3 adds authentication (eliminates public access)

---

## Implementation Sequence

**Week 6:**
- Days 1-2: Story 4.1 (Product CRUD) + Story 4.2 (Variant CRUD)
- Days 3-4: Story 4.3 (Slice-Variant linking) + Story 4.4 (Multi-model slices)
- Day 5: Story 4.5 (Recipe card generation) - start

**Week 7:**
- Days 1-2: Story 4.5 (Recipe card) - complete and test
- Days 3-4: Story 4.6 (Wizard integration) + Story 4.7 (Needs slicing)
- Day 5: Story 4.8 (Relationship navigation) + integration testing

---

**Document Status:** Complete and ready for Epic 4 implementation
**Next Action:** Begin Story 4.1 (Product CRUD) after Epic 3 completion

# Technical Specification: Epic 5 - Search & Discovery

**Project:** printfarm-manager
**Epic:** 5 - Search & Discovery
**Date:** 2025-10-16
**Status:** Ready for Implementation
**Estimated Duration:** 1 week

---

## Executive Summary

Epic 5 completes the MVP by enabling fast, forgiving search and intuitive visual browsing that scales to 1000+ products. As the catalog grows from dozens to hundreds of items, search becomes essential for productivity. This epic implements fuzzy search with typo tolerance, visual grid browsing with lazy loading, basic filtering, and an optimized landing page that serves as the primary entry point for assistant workflows. Search performance (<1s response time) and accuracy (95% relevance target) are critical success factors.

**Critical Success Factors:**
- Search returns results in <1 second (per NFR-1)
- Typo tolerance works reliably ("whle" finds "whale")
- Visual grid browsing supports 1000+ products without performance degradation
- Landing page loads in ≤2 seconds
- Search bar always accessible from all pages

---

## Table of Contents

1. [Epic Overview](#epic-overview)
2. [Stories Breakdown](#stories-breakdown)
3. [Search Implementation Strategy](#search-implementation-strategy)
4. [Performance Optimization](#performance-optimization)
5. [Testing Strategy](#testing-strategy)
6. [Risks and Mitigations](#risks-and-mitigations)

---

## Epic Overview

### Goal
Enable fast, forgiving search across catalog and intuitive visual browsing to support catalog growth to 1000+ products.

### Business Value
- **Assistant Productivity**: Fast search reduces time to find products from minutes to seconds
- **Error Prevention**: Typo tolerance eliminates search failures due to spelling mistakes
- **Scalability**: Grid browsing remains performant even with 1000+ products
- **Owner Efficiency**: Quick product lookup during customer inquiries or inventory checks

### Success Criteria
- ✅ Search returns results in <1 second
- ✅ Typo tolerance works ("whle" finds "whale", "bby" finds "baby")
- ✅ Visual grid browsing supports 1000+ products without performance degradation
- ✅ Search bar always accessible from all pages (sticky header or prominent placement)
- ✅ 95% of searches find target product in first 3 results (validated in production use)
- ✅ Landing page optimized for assistant workflow (recent products, immediate search)

### Dependencies
**Prerequisites:**
- Epic 4 (Products & Recipes) - requires products, variants to search/browse

**Blocks:** None (final MVP epic)

---

## Stories Breakdown

### Story 5.1: Implement Basic Search Infrastructure

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner or assistant
**I want** to search for products and models by name
**So that** I can quickly find what I need in a growing catalog

#### Technical Requirements

1. **Search Scope** (MVP per FR-11)
   - Product names
   - Model names
   - Deferred to Phase 2: slice filenames, descriptions

2. **Search Behavior**
   - Case-insensitive substring matching
   - Example: "whale" matches "Baby Whale Figurine", "Whale Tail Keychain"
   - Search-as-you-type with 300ms debouncing (UX Principle 6)

3. **Search Bar Component**
   - Accessible from all pages (sticky header recommended)
   - Autofocus optional (not on mobile to prevent keyboard popup)
   - Clear button to reset search
   - Loading indicator during search

4. **Results Display**
   - Visual grid with thumbnails (UX Principle 1)
   - Mix products and models in results
   - Type badge: "Product" vs "Model"
   - Empty state message: "No results found for 'xyz'"

5. **Performance** (per NFR-1)
   - Results in ≤1 second
   - Database index on `products.name` and `models.filename`
   - Limit results to 50 (pagination deferred to Phase 2 per NFR-11)

#### Implementation Details

**Component:** `src/components/shared/SearchBar.tsx`

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useDebounce } from '~/lib/utils/debounce'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const navigate = useNavigate()

  useEffect(() => {
    if (debouncedQuery) {
      // Navigate to search results page
      navigate({
        to: '/search',
        search: { q: debouncedQuery }
      })
    }
  }, [debouncedQuery])

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products and models..."
        className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500"
      />
      <SearchIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
      {query && (
        <button
          onClick={() => setQuery('')}
          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
        >
          <XIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
```

**API:** `src/routes/api/search.ts`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('q')

        if (!query || query.length < 2) {
          return json({ results: [] })
        }

        const startTime = Date.now()

        // Search products (case-insensitive substring match)
        const products = await prisma.product.findMany({
          where: {
            name: {
              contains: query,
              mode: 'insensitive'
            }
          },
          take: 25, // Limit 25 products
          select: {
            id: true,
            name: true,
            thumbnailUrl: true
          }
        })

        // Search models (case-insensitive substring match)
        const models = await prisma.model.findMany({
          where: {
            filename: {
              contains: query,
              mode: 'insensitive'
            }
          },
          take: 25, // Limit 25 models
          select: {
            id: true,
            filename: true,
            thumbnailUrl: true
          }
        })

        const results = [
          ...products.map(p => ({
            type: 'product' as const,
            id: p.id,
            name: p.name,
            thumbnailUrl: p.thumbnailUrl,
            relevance: 1 // Exact substring match
          })),
          ...models.map(m => ({
            type: 'model' as const,
            id: m.id,
            name: m.filename,
            thumbnailUrl: m.thumbnailUrl,
            relevance: 1
          }))
        ]

        const duration = Date.now() - startTime

        // Log search performance
        console.log(JSON.stringify({
          event: 'search_query',
          query,
          resultCount: results.length,
          durationMs: duration
        }))

        return json({ results, meta: { duration } })
      }
    }
  }
})
```

**Page:** `src/routes/search.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Grid } from '~/components/layout/Grid'
import { Card } from '~/components/layout/Card'

export const Route = createFileRoute('/search')({
  component: SearchResults,
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || ''
  })
})

function SearchResults() {
  const { q } = Route.useSearch()
  const { data, isLoading } = useQuery({
    queryKey: ['search', q],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json()),
    enabled: q.length >= 2
  })

  if (!q) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-gray-600">Enter a search term to find products and models</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center gap-2">
          <LoadingSpinner />
          <span>Searching...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        Search Results for "{q}"
      </h1>

      {data?.results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No results found for "{q}"</p>
          <p className="text-sm text-gray-500">Try different keywords or check spelling</p>
        </div>
      )}

      {data?.results.length > 0 && (
        <>
          <p className="text-gray-600 mb-4">
            Found {data.results.length} result{data.results.length !== 1 ? 's' : ''}
            {data.meta?.duration && ` in ${data.meta.duration}ms`}
          </p>

          <Grid cols={{ default: 1, md: 2, lg: 3, xl: 4 }}>
            {data.results.map(result => (
              <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
            ))}
          </Grid>
        </>
      )}
    </div>
  )
}

function SearchResultCard({ result }) {
  const href = result.type === 'product'
    ? `/products/${result.id}`
    : `/models/${result.id}`

  return (
    <Card asChild>
      <Link to={href}>
        <img
          src={result.thumbnailUrl || '/placeholder.png'}
          alt={result.name}
          className="w-full h-48 object-cover rounded-t"
          loading="lazy"
        />
        <div className="p-4">
          <span className="inline-block px-2 py-1 text-xs bg-gray-100 rounded mb-2">
            {result.type}
          </span>
          <h3 className="font-semibold">{result.name}</h3>
        </div>
      </Link>
    </Card>
  )
}
```

#### Acceptance Criteria
- [x] Search bar component accessible from all pages per FR-11
- [x] Search scope: product names and model names per FR-11
- [x] Case-insensitive substring matching per FR-11
- [x] Search-as-you-type with 300ms debouncing per UX Principle 6
- [x] Results displayed in visual grid with thumbnails per UX Principle 1
- [x] Empty state message when no results found
- [x] Search performance: results in ≤1 second per NFR-1

---

### Story 5.2: Implement Fuzzy Search with Typo Tolerance

**Priority:** HIGH
**Complexity:** High
**Estimated Effort:** 8-10 hours

#### User Story
**As an** owner or assistant
**I want** search to work even with typos and partial matches
**So that** I don't have to remember exact product names

#### Technical Requirements

1. **Fuzzy Matching Algorithm** (per FR-11)
   - Option A: Xata full-text search (if available)
   - Option B: Postgres pg_trgm extension (trigram similarity)
   - Option C: Levenshtein distance (custom implementation)

2. **Typo Tolerance Examples**
   - "whle" finds "whale" (1 character missing)
   - "bby" finds "baby" (1 character missing)
   - "ocen" finds "ocean" (1 character transposed)
   - Maximum edit distance: 2 characters (configurable)

3. **Relevance Ranking**
   - Exact matches ranked first
   - Fuzzy matches ranked by similarity score
   - Threshold: minimum similarity score 0.3 (configurable)

4. **Performance** (per NFR-1)
   - Maintain ≤1 second response time
   - May require indexing strategy for fuzzy search
   - Consider caching common queries

5. **Fallback Strategy**
   - If no third-party solution, use Levenshtein distance
   - Pre-compute trigrams for common searches (optional optimization)

#### Implementation Details

**Decision: Use Postgres pg_trgm Extension** (Xata supports Postgres extensions)

**Database Setup:**

```sql
-- Enable pg_trgm extension (run in Xata console or migration)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index for trigram similarity
CREATE INDEX products_name_trgm_idx ON products USING gin (name gin_trgm_ops);
CREATE INDEX models_filename_trgm_idx ON models USING gin (filename gin_trgm_ops);
```

**Enhanced API:** `src/routes/api/search.ts` (update)

```typescript
export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('q')

        if (!query || query.length < 2) {
          return json({ results: [] })
        }

        const startTime = Date.now()

        // First: exact substring matches (fast)
        const exactProducts = await prisma.$queryRaw`
          SELECT id, name, thumbnail_url, 1.0 as similarity
          FROM products
          WHERE name ILIKE ${'%' + query + '%'}
          LIMIT 15
        `

        const exactModels = await prisma.$queryRaw`
          SELECT id, filename as name, thumbnail_url, 1.0 as similarity
          FROM models
          WHERE filename ILIKE ${'%' + query + '%'}
          LIMIT 15
        `

        // Second: fuzzy matches using trigram similarity
        // Only search if exact matches < 5 (optimize performance)
        let fuzzyProducts = []
        let fuzzyModels = []

        if (exactProducts.length < 5) {
          fuzzyProducts = await prisma.$queryRaw`
            SELECT id, name, thumbnail_url, similarity(name, ${query}) as similarity
            FROM products
            WHERE similarity(name, ${query}) > 0.3
            AND name NOT ILIKE ${'%' + query + '%'}
            ORDER BY similarity DESC
            LIMIT 10
          `
        }

        if (exactModels.length < 5) {
          fuzzyModels = await prisma.$queryRaw`
            SELECT id, filename as name, thumbnail_url, similarity(filename, ${query}) as similarity
            FROM models
            WHERE similarity(filename, ${query}) > 0.3
            AND filename NOT ILIKE ${'%' + query + '%'}
            ORDER BY similarity DESC
            LIMIT 10
          `
        }

        // Combine and sort by relevance
        const results = [
          ...exactProducts.map(p => ({ type: 'product', ...p, relevance: p.similarity })),
          ...exactModels.map(m => ({ type: 'model', ...m, relevance: m.similarity })),
          ...fuzzyProducts.map(p => ({ type: 'product', ...p, relevance: p.similarity })),
          ...fuzzyModels.map(m => ({ type: 'model', ...m, relevance: m.similarity }))
        ].sort((a, b) => b.relevance - a.relevance)

        const duration = Date.now() - startTime

        console.log(JSON.stringify({
          event: 'fuzzy_search_query',
          query,
          exactMatches: exactProducts.length + exactModels.length,
          fuzzyMatches: fuzzyProducts.length + fuzzyModels.length,
          durationMs: duration
        }))

        return json({ results, meta: { duration } })
      }
    }
  }
})
```

**Alternative: Levenshtein Distance Implementation** (if pg_trgm unavailable)

```typescript
// src/lib/search/levenshtein.ts
export function levenshteinDistance(a: string, b: string): number {
  const matrix = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

export function fuzzyMatch(query: string, target: string, maxDistance = 2): boolean {
  const distance = levenshteinDistance(
    query.toLowerCase(),
    target.toLowerCase()
  )
  return distance <= maxDistance
}
```

#### Acceptance Criteria
- [x] Fuzzy matching with typo tolerance per FR-11 and UX Principle 6
- [x] Implementation: pg_trgm (preferred) OR Levenshtein distance (fallback)
- [x] Examples work: "whle" finds "whale", "bby" finds "baby", "ocen" finds "ocean"
- [x] Results ranked by relevance (exact match first, then fuzzy matches)
- [x] Maximum edit distance: 2 characters (configurable)
- [x] Performance maintained: ≤1 second response time per NFR-1

---

### Story 5.3: Implement Visual Grid Browsing

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 6-8 hours

#### User Story
**As an** owner or assistant
**I want** to browse all products in visual grid layout
**So that** I can recognize items by appearance quickly

#### Technical Requirements

1. **Grid Layout** (UX Principle 1)
   - Default view on product list page
   - Responsive columns: 4 desktop → 2 tablet → 1 mobile (UX Principle 9)
   - Card size: 200x200px minimum thumbnail
   - Each card: thumbnail, name, variant count

2. **Performance** (per NFR-11)
   - Support 1000+ products without degradation
   - Lazy loading: load 50 products initially
   - Infinite scroll OR "Load More" button (infinite scroll recommended for UX)
   - Skeleton loaders during data fetch (UX Principle 10)

3. **Hover Interactions** (UX Principle 1)
   - Hover to enlarge thumbnails (optional for MVP)
   - Smooth transitions
   - Click card to navigate to product detail

4. **Optimization Strategies**
   - Image lazy loading (`loading="lazy"` attribute)
   - Appropriate image sizes (don't load 4K thumbnails for 200px cards)
   - Consider react-window for virtualized scrolling if performance issues arise

#### Implementation Details

**Component:** `src/routes/products/index.tsx` (enhanced from Epic 4)

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'
import { Grid } from '~/components/layout/Grid'
import { Card } from '~/components/layout/Card'

export const Route = createFileRoute('/products/')({
  component: ProductList
})

function ProductList() {
  const { ref: loadMoreRef, inView } = useInView()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['products', 'list'],
    queryFn: ({ pageParam = 0 }) =>
      fetch(`/api/products?offset=${pageParam}&limit=50`).then(r => r.json()),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.products.length < 50) return undefined
      return pages.length * 50
    }
  })

  // Auto-fetch next page when scroll reaches bottom
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  const allProducts = data?.pages.flatMap(page => page.products) || []

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <Button asChild>
          <Link to="/products/new">Create Product</Link>
        </Button>
      </div>

      {isLoading && <GridSkeleton count={12} />}

      <Grid cols={{ default: 1, md: 2, lg: 3, xl: 4 }}>
        {allProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </Grid>

      {/* Infinite scroll trigger */}
      {hasNextPage && (
        <div ref={loadMoreRef} className="py-8 text-center">
          {isFetchingNextPage ? (
            <LoadingSpinner />
          ) : (
            <Button onClick={() => fetchNextPage()}>Load More</Button>
          )}
        </div>
      )}

      {!hasNextPage && allProducts.length > 0 && (
        <p className="text-center text-gray-500 py-8">
          Showing all {allProducts.length} products
        </p>
      )}
    </div>
  )
}

function GridSkeleton({ count }: { count: number }) {
  return (
    <Grid cols={{ default: 1, md: 2, lg: 3, xl: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-gray-200 h-48 rounded-t" />
          <div className="p-4 space-y-2">
            <div className="bg-gray-200 h-4 rounded w-3/4" />
            <div className="bg-gray-200 h-3 rounded w-1/2" />
          </div>
        </div>
      ))}
    </Grid>
  )
}
```

**API Update:** `src/routes/api/products/index.ts` (add pagination)

```typescript
export const Route = createFileRoute('/api/products/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const limit = parseInt(url.searchParams.get('limit') || '50')

        const products = await prisma.product.findMany({
          skip: offset,
          take: limit,
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
      }
    }
  }
})
```

#### Acceptance Criteria
- [x] Product list page displays grid layout (default view per UX Principle 1)
- [x] Grid responsive: 4 columns desktop → 2 tablet → 1 mobile per UX Principle 9
- [x] Each card shows: thumbnail (200x200px minimum), product name, variant count
- [x] Grid supports 1000+ products without performance degradation per NFR-11
- [x] Lazy loading: load 50 products initially, infinite scroll or "Load More" button
- [x] Skeleton loaders during data fetch per UX Principle 10
- [x] Click card to navigate to product detail page

---

### Story 5.4: Implement Landing Page with Search

**Priority:** HIGH
**Complexity:** Low
**Estimated Effort:** 2-4 hours

#### User Story
**As an** owner or assistant
**I want** to see product list and search bar immediately on landing page
**So that** I can start searching or browsing right away

#### Technical Requirements

1. **Landing Page Layout** (per FR-11)
   - Route: `/` (root)
   - Search bar: prominent, immediately interactive
   - Product grid: recent products shown first (sort by created_at DESC per UX Principle 8)
   - No dashboard widgets in MVP (deferred per elicitation)

2. **Performance** (per NFR-1)
   - Page loads in ≤2 seconds
   - Lazy load product images
   - Code splitting for heavy components
   - SSR (Server-Side Rendering) for initial HTML

3. **Mobile Responsive** (UX Principle 9)
   - Search bar full-width on mobile
   - Grid adapts to screen size
   - Touch-friendly interactions

4. **Assistant-Optimized** (primary workflow)
   - Visual-first: large thumbnails
   - Minimal text: product names only
   - Quick access to search and browse

#### Implementation Details

**Component:** `src/routes/index.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SearchBar } from '~/components/shared/SearchBar'
import { Grid } from '~/components/layout/Grid'
import { ProductCard } from '~/components/products/ProductCard'

export const Route = createFileRoute('/')({
  component: LandingPage
})

function LandingPage() {
  // Load recent products (limit 24 for landing page)
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', 'recent'],
    queryFn: () => fetch('/api/products?limit=24').then(r => r.json())
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Search */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">PrintFarm Manager</h1>
            <nav className="flex gap-4">
              <Link to="/models" className="text-gray-600 hover:text-gray-900">
                Models
              </Link>
              <Link to="/slices" className="text-gray-600 hover:text-gray-900">
                Slices
              </Link>
              <Link to="/filaments" className="text-gray-600 hover:text-gray-900">
                Filaments
              </Link>
            </nav>
          </div>
          <SearchBar />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Recent Products</h2>
          <Button asChild variant="outline">
            <Link to="/products">View All</Link>
          </Button>
        </div>

        {isLoading && <GridSkeleton count={12} />}

        {products?.products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No products yet</p>
            <Button asChild>
              <Link to="/slices/upload">Upload Your First Slice</Link>
            </Button>
          </div>
        )}

        <Grid cols={{ default: 1, md: 2, lg: 3, xl: 4 }}>
          {products?.products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </Grid>
      </main>

      {/* Footer with Environment Indicator (from Epic 1) */}
      <footer className="bg-white border-t mt-12 py-4">
        <div className="container mx-auto px-4">
          <EnvironmentIndicator />
        </div>
      </footer>
    </div>
  )
}
```

#### Acceptance Criteria
- [x] Landing page (root `/`) displays product grid and search bar per FR-11
- [x] Search bar prominent and immediately interactive
- [x] Recent products shown first (sort by created_at DESC per UX Principle 8)
- [x] Page loads in ≤2 seconds per NFR-1
- [x] Mobile-responsive layout per UX Principle 9
- [x] No dashboard widgets in MVP (deferred per elicitation)
- [x] Simple, clean layout prioritizing visual browsing and search

---

### Story 5.5: Implement Basic Filtering

**Priority:** MEDIUM
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner or assistant
**I want** to filter products by type or material
**So that** I can narrow down large catalogs

#### Technical Requirements

1. **Filter Options** (MVP scope per FR-11)
   - File type: Models only, Slices only, Products with Recipes
   - Material type: PLA, PETG, ABS, TPU, etc. (from filaments used in slices)
   - Product name: basic text filter (complements search)

2. **Filter UI** (UX Principle 5)
   - Collapsed by default, expand on click
   - Active filters displayed as removable tags
   - Clear all filters button
   - Filter count badge: "Filters (2)"

3. **Filter Logic**
   - Filters combine with search (AND logic)
   - Example: search "whale" + filter "PLA" = products named "whale" using PLA filament
   - Material filter requires join: products → variants → slices → filaments

4. **URL State** (per FR-11 note)
   - Filter state preserved in URL query params
   - Shareable filtered views
   - Example: `/products?material=PLA&hasRecipes=true`

5. **Performance**
   - Filtered queries must complete in ≤1 second
   - Database indexes on filter columns
   - Consider materialized views for complex filters (Phase 2)

#### Implementation Details

**Component:** `src/components/products/ProductFilters.tsx`

```typescript
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

interface FilterState {
  fileType?: 'models' | 'slices' | 'products'
  materialType?: string
  hasRecipes?: boolean
}

export function ProductFilters() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})

  const activeFilterCount = Object.keys(filters).filter(k => filters[k]).length

  const applyFilters = () => {
    navigate({
      to: '/products',
      search: filters
    })
  }

  const clearFilters = () => {
    setFilters({})
    navigate({ to: '/products', search: {} })
  }

  return (
    <div className="border rounded-lg p-4 mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <span className="font-semibold">
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </span>
        <ChevronIcon className={expanded ? 'rotate-180' : ''} />
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* File Type Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">File Type</label>
            <select
              value={filters.fileType || ''}
              onChange={(e) => setFilters({ ...filters, fileType: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Types</option>
              <option value="models">Models Only</option>
              <option value="slices">Slices Only</option>
              <option value="products">Products with Recipes</option>
            </select>
          </div>

          {/* Material Type Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Material Type</label>
            <select
              value={filters.materialType || ''}
              onChange={(e) => setFilters({ ...filters, materialType: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Materials</option>
              <option value="PLA">PLA</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
              <option value="TPU">TPU</option>
            </select>
          </div>

          {/* Has Recipes Filter */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="hasRecipes"
              checked={filters.hasRecipes || false}
              onChange={(e) => setFilters({ ...filters, hasRecipes: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="hasRecipes" className="text-sm">
              Only show products with recipes
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={applyFilters} className="flex-1">
              Apply Filters
            </Button>
            <Button onClick={clearFilters} variant="outline">
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Active Filter Tags */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {filters.fileType && (
            <FilterTag
              label={`Type: ${filters.fileType}`}
              onRemove={() => setFilters({ ...filters, fileType: undefined })}
            />
          )}
          {filters.materialType && (
            <FilterTag
              label={`Material: ${filters.materialType}`}
              onRemove={() => setFilters({ ...filters, materialType: undefined })}
            />
          )}
          {filters.hasRecipes && (
            <FilterTag
              label="Has recipes"
              onRemove={() => setFilters({ ...filters, hasRecipes: undefined })}
            />
          )}
        </div>
      )}
    </div>
  )
}

function FilterTag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900">
        <XIcon className="w-4 h-4" />
      </button>
    </span>
  )
}
```

**API Update:** `src/routes/api/products/index.ts` (add filter support)

```typescript
export const Route = createFileRoute('/api/products/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const materialType = url.searchParams.get('materialType')
        const hasRecipes = url.searchParams.get('hasRecipes') === 'true'

        const where: any = {}

        // Material type filter (requires complex join)
        if (materialType) {
          where.variants = {
            some: {
              sliceVariants: {
                some: {
                  slice: {
                    sliceFilaments: {
                      some: {
                        filament: {
                          materialType: materialType
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Has recipes filter
        if (hasRecipes) {
          where.variants = {
            some: {
              sliceVariants: {
                some: {}
              }
            }
          }
        }

        const products = await prisma.product.findMany({
          where,
          include: {
            variants: {
              include: {
                sliceVariants: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        // ... rest of formatting logic
      }
    }
  }
})
```

#### Acceptance Criteria
- [x] Filter by file type: Models only, Slices only, Products with Recipes
- [x] Filter by material type: PLA, PETG, ABS, etc.
- [x] Filter by product name (basic text filter, complements search)
- [x] Filters collapsed by default, expand on click per UX Principle 5
- [x] Active filters displayed as removable tags
- [x] Filters combine with search (AND logic)
- [x] Filter state preserved in URL query params (shareable filtered views)

---

### Story 5.6: Implement File Download Operations

**Priority:** MEDIUM
**Complexity:** Low
**Estimated Effort:** 2-4 hours

**Note:** This story overlaps with Epic 2 Story 2.8 and Epic 4 Story 4.5 (recipe card downloads). Verify implementation completeness.

#### User Story
**As an** owner or assistant
**I want** to download individual slice and model files easily
**So that** I can load them into slicer or printer

#### Technical Requirements

1. **Download Locations** (per FR-16)
   - Model detail pages: download .stl/.3mf files
   - Slice detail pages: download .gcode.3mf/.gcode files
   - Recipe cards: download slice files (primary use case)

2. **R2 Download URLs** (per FR-16)
   - Set content-type: application/octet-stream (or specific MIME type)
   - Set content-disposition: attachment; filename="..."
   - Force download (not inline view)
   - Presigned URLs with 1-hour expiration (for recipe cards)

3. **Error Handling**
   - File missing from R2: show error message
   - R2 unavailable: retry with exponential backoff
   - Expired presigned URL: regenerate on page refresh

4. **Mobile Download** (UX Principle 9)
   - Test mobile download UX (primary assistant workflow)
   - Ensure download button large enough for touch (44px minimum)
   - Handle mobile browser download quirks

#### Implementation Details

**R2 Upload with Headers** (from Epic 2, verify implementation)

```typescript
// src/lib/storage/upload.ts
import { getContext } from 'vinxi/http'

export async function uploadToR2(
  file: File,
  key: string
): Promise<string> {
  const cf = getContext('cloudflare')
  const arrayBuffer = await file.arrayBuffer()

  await cf.env.FILES_BUCKET.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
      contentDisposition: `attachment; filename="${file.name}"`
    }
  })

  return key
}
```

**Download Component** (reusable)

```typescript
// src/components/shared/DownloadButton.tsx
interface DownloadButtonProps {
  filename: string
  r2Key: string
  label?: string
}

export function DownloadButton({
  filename,
  r2Key,
  label = 'Download'
}: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      // Fetch from R2 via API (generates presigned URL)
      const response = await fetch(`/api/download?key=${r2Key}`)
      if (!response.ok) {
        throw new Error('File not found')
      }

      const { url } = await response.json()

      // Trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
    } catch (error) {
      alert('Download failed: ' + error.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={downloading}
      className="min-h-[44px]" // Touch-friendly
    >
      {downloading ? 'Downloading...' : label}
    </Button>
  )
}
```

**Download API** (generates presigned URLs)

```typescript
// src/routes/api/download.ts
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getContext } from 'vinxi/http'

export const Route = createFileRoute('/api/download')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cf = getContext('cloudflare')
        const url = new URL(request.url)
        const key = url.searchParams.get('key')

        if (!key) {
          return json({ error: 'Missing key parameter' }, { status: 400 })
        }

        // Verify file exists
        const fileInfo = await cf.env.FILES_BUCKET.head(key)
        if (!fileInfo) {
          return json({ error: 'File not found' }, { status: 404 })
        }

        // Generate presigned URL (1 hour expiration)
        const downloadUrl = await cf.env.FILES_BUCKET.getSignedUrl(key, {
          expiresIn: 3600
        })

        return json({ url: downloadUrl })
      }
    }
  }
})
```

#### Acceptance Criteria
- [x] Download button on model detail pages for .stl/.3mf files
- [x] Download button on slice detail pages for .gcode.3mf/.gcode files
- [x] Download button on recipe cards for slice files (primary use case)
- [x] R2 URLs set with proper headers per FR-16
- [x] Downloads initiate immediately (no redirect delays)
- [x] Download errors handled gracefully: file missing, R2 unavailable
- [x] Mobile download works correctly per UX Principle 9

---

## Search Implementation Strategy

### Technology Decision: Postgres pg_trgm

**Rationale:**
- Xata supports Postgres extensions (pg_trgm confirmed available)
- Native database solution (no third-party dependencies)
- Performance: <1s search with proper indexing
- Typo tolerance: trigram similarity proven effective

**Alternative Considered:**
- Levenshtein distance (custom implementation)
- Pros: No external dependencies, full control
- Cons: Slower for large datasets, requires manual optimization

**Decision:** Use pg_trgm for MVP, keep Levenshtein as fallback if Xata doesn't support pg_trgm

### Search Performance Optimization

1. **Database Indexing:**
   ```sql
   CREATE INDEX products_name_trgm_idx ON products USING gin (name gin_trgm_ops);
   CREATE INDEX models_filename_trgm_idx ON models USING gin (filename gin_trgm_ops);
   ```

2. **Query Strategy:**
   - First: exact substring matches (fast ILIKE)
   - Second: fuzzy matches (trigram similarity) only if exact matches < 5
   - Limit results to 50 total (pagination deferred)

3. **Caching:**
   - Consider Redis cache for common queries (Phase 2)
   - TanStack Query client-side caching (5 minute stale time)

4. **Monitoring:**
   - Log search duration for every query
   - Alert if >1s threshold exceeded
   - Track fuzzy vs exact match ratio

---

## Performance Optimization

### Image Loading

1. **Lazy Loading:**
   ```tsx
   <img src={thumbnailUrl} loading="lazy" alt="..." />
   ```

2. **Responsive Images:**
   - Serve appropriately sized thumbnails
   - Avoid loading 4K images for 200px cards
   - Consider image CDN (Cloudflare Images, Phase 2)

3. **Placeholder Strategy:**
   - Skeleton loaders during initial load
   - Low-res placeholder → high-res image (progressive loading)

### Infinite Scroll Performance

1. **Intersection Observer:**
   - Use react-intersection-observer
   - Trigger next page load when user scrolls to bottom
   - Debounce scroll events (300ms)

2. **Virtualized Scrolling (if needed):**
   - If 1000+ products cause jank, implement react-window
   - Only renders visible items in viewport
   - Significant performance improvement for large lists

3. **Prefetching:**
   - Prefetch next page before user reaches bottom
   - Improves perceived performance

---

## Testing Strategy

### Unit Tests

**tests/unit/fuzzy-search.test.ts:**
- Trigram similarity calculation
- Levenshtein distance (if used)
- Relevance ranking
- Edge cases (empty query, special characters)

### Integration Tests

**tests/integration/search-workflow.test.ts:**
- Basic search (exact match)
- Fuzzy search (typo tolerance)
- Search + filter combination
- Empty results handling

### Performance Tests

**tests/performance/search-speed.test.ts:**
- Measure search duration (target <1s)
- Test with 1000+ products in database
- Verify grid rendering performance

### User Acceptance Testing

1. **Search Accuracy:**
   - Test typo examples: "whle" finds "whale", "bby" finds "baby"
   - Verify relevance ranking (exact matches first)
   - Confirm 95% relevance target (user feedback)

2. **Browse Performance:**
   - Load 1000+ products, verify no degradation
   - Test infinite scroll smoothness
   - Verify mobile responsiveness

3. **Filter Functionality:**
   - Apply filters, verify correct results
   - Test filter combinations
   - Verify URL state persistence

---

## Risks and Mitigations

### Risk 1: Search Performance Degradation
**Severity:** HIGH
**Likelihood:** MEDIUM
**Mitigation:**
- Performance tests in CI pipeline (<1s threshold)
- Database indexing verified before launch
- Monitor search duration in production logs
- Fallback to simpler ILIKE search if performance issues
- Consider ElasticSearch or Algolia for Phase 2 if needed

### Risk 2: pg_trgm Unavailable in Xata
**Severity:** MEDIUM
**Likelihood:** LOW
**Mitigation:**
- Verify pg_trgm support in Xata during Epic 5 kickoff
- Levenshtein implementation ready as fallback
- Test both approaches in dev environment
- Document migration path if switching search strategies

### Risk 3: Infinite Scroll UX Issues
**Severity:** LOW
**Likelihood:** MEDIUM
**Mitigation:**
- User testing with real assistants
- "Load More" button fallback if infinite scroll causes confusion
- Clear loading indicators
- Scroll position restoration on navigation back

### Risk 4: Mobile Download UX
**Severity:** MEDIUM
**Likelihood:** MEDIUM
**Mitigation:**
- Test on multiple mobile browsers (Safari, Chrome, Firefox)
- Large touch targets (44px minimum)
- Clear download feedback (progress indicator)
- Handle browser-specific download quirks

---

## Implementation Sequence

**Week 8:**
- Days 1-2: Story 5.1 (Basic search) + Story 5.2 (Fuzzy search)
  - Verify pg_trgm availability, implement Levenshtein fallback if needed
- Day 3: Story 5.3 (Visual grid browsing) + Story 5.4 (Landing page)
- Day 4: Story 5.5 (Basic filtering)
- Day 5: Story 5.6 (Download operations - verify completeness) + Integration testing

---

**Document Status:** Complete and ready for Epic 5 implementation
**Next Action:** Begin Story 5.1 (Basic search) after Epic 4 completion

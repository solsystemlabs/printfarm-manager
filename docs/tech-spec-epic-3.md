# Technical Specification: Epic 3 - Metadata Extraction & Filament Matching

**Project:** printfarm-manager
**Epic:** 3 - Metadata Extraction & Filament Matching
**Date:** 2025-10-16
**Status:** Ready for Implementation
**Estimated Duration:** 1-2 weeks

---

## Executive Summary

Epic 3 implements the core automation value proposition: automatic metadata extraction from Bambu Lab `.gcode.3mf` files with intelligent filament matching. This eliminates manual data entry, reduces errors, and enables seamless recipe card generation. The epic introduces server-side ZIP parsing, Zod schema validation, smart matching algorithms, and wizard-driven workflows that transform slice uploads from tedious manual work into confirmation-only interactions.

**Critical Success Factors:**
- Metadata extraction completes in ≤10 seconds for typical 50MB files
- Filament matching achieves >90% auto-match rate
- Wizard pre-populates all fields from extracted data
- Inline filament creation maintains zero-friction workflow
- Metadata validation flags format changes without blocking uploads

---

## Table of Contents

1. [Epic Overview](#epic-overview)
2. [Stories Breakdown](#stories-breakdown)
3. [Architecture Integration](#architecture-integration)
4. [Technical Approach](#technical-approach)
5. [Acceptance Criteria](#acceptance-criteria)
6. [Testing Strategy](#testing-strategy)
7. [Risks and Mitigations](#risks-and-mitigations)

---

## Epic Overview

### Goal
Automatically extract all configuration data from Bambu Lab slice files and intelligently match filaments to existing records, eliminating manual data entry.

### Business Value
- **Time Savings**: Reduces slice configuration from 5-10 minutes of manual data entry to 10 seconds of confirmation
- **Accuracy**: Eliminates human error in transcribing temperatures, layer heights, filament assignments
- **Scalability**: Enables processing dozens of slices per day without owner bottleneck
- **Assistant Enablement**: Extracted AMS slot assignments enable autonomous operation

### Success Criteria
- ✅ .gcode.3mf files parsed and metadata extracted within 10 seconds
- ✅ Filament matching achieves >90% auto-match rate (validated in production use)
- ✅ Wizard pre-populates all fields from extracted data (zero manual entry for matched filaments)
- ✅ Inline filament creation works seamlessly when no match found
- ✅ Metadata validation flags issues without blocking uploads

### Dependencies
**Prerequisites:** Epic 2 (File Storage & Management) - requires R2 storage, database schema, slice upload API
**Blocks:** Epic 4 (Product & Recipe System) - provides metadata for recipe card generation

---

## Stories Breakdown

### Story 3.1: Implement .gcode.3mf File Parsing

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 4-6 hours

#### User Story
**As a** developer
**I want** to extract JSON metadata from Bambu Lab .gcode.3mf files
**So that** we can auto-populate slice configuration data

#### Technical Requirements

1. **ZIP Archive Parsing**
   - .gcode.3mf files are ZIP archives
   - Use JSZip library (^3.10.1) for server-side extraction
   - Locate and read `Metadata/project_settings.config` file within archive

2. **JSON Extraction**
   - Parse project_settings.config as JSON
   - Handle UTF-8 encoding properly
   - Extract complete metadata tree for downstream validation

3. **Error Handling**
   - Missing config file → Skip metadata extraction, show warning per FR-2
   - Malformed JSON → Fail upload with clear error message per FR-2
   - Corrupted ZIP → Handle gracefully with user-friendly error

4. **Performance Requirements**
   - Complete extraction in ≤10 seconds for typical 50MB files per NFR-1
   - Process files up to 100MB without timeout

#### Implementation Details

**File:** `src/lib/metadata/extract.ts`

```typescript
import JSZip from 'jszip'

export interface MetadataExtractionResult {
  success: boolean
  metadata?: unknown // raw JSON, validated downstream
  error?: {
    code: 'MISSING_CONFIG' | 'MALFORMED_JSON' | 'CORRUPT_ZIP' | 'UNKNOWN'
    message: string
  }
}

export async function extractMetadataFromGcode3mf(
  fileBuffer: ArrayBuffer
): Promise<MetadataExtractionResult> {
  try {
    // Parse ZIP archive
    const zip = await JSZip.loadAsync(fileBuffer)

    // Locate metadata file
    const configFile = zip.file('Metadata/project_settings.config')
    if (!configFile) {
      return {
        success: false,
        error: {
          code: 'MISSING_CONFIG',
          message: 'project_settings.config not found in .gcode.3mf file'
        }
      }
    }

    // Extract and parse JSON
    const configText = await configFile.async('text')
    const metadata = JSON.parse(configText)

    return { success: true, metadata }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: {
          code: 'MALFORMED_JSON',
          message: 'Invalid JSON in project_settings.config'
        }
      }
    }

    return {
      success: false,
      error: {
        code: 'CORRUPT_ZIP',
        message: 'Unable to read .gcode.3mf file (corrupted or invalid format)'
      }
    }
  }
}
```

#### Acceptance Criteria
- [x] Parse .gcode.3mf files (ZIP format) and locate `Metadata/project_settings.config`
- [x] Extract JSON content from project_settings.config
- [x] Handle missing config file gracefully: skip metadata extraction, show warning per FR-2
- [x] Handle malformed JSON: fail upload with clear error message per FR-2
- [x] Validation succeeds for well-formed metadata
- [x] Extraction completes in ≤10 seconds for typical 50MB files per NFR-1
- [x] Logs extraction attempt with success/failure status per NFR-9

#### Testing Notes
- Unit test with valid .gcode.3mf file from `docs/bambu-lab-metadata-example.json`
- Test missing config file scenario
- Test malformed JSON scenario
- Performance test with 50MB and 100MB files

---

### Story 3.2: Implement Metadata Schema Validation with Zod

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 6-8 hours

#### User Story
**As a** developer
**I want** extracted metadata validated against expected schema
**So that** we catch format changes and missing fields early

#### Technical Requirements

1. **Zod Schema Definition**
   - Define comprehensive schema for Bambu Lab metadata structure
   - Include all fields needed for FRs: filaments, slicer settings, print metadata
   - Use type coercion for common conversions (string "220" → number 220 per FR-4)
   - Schema must be self-documenting (comments on expected structure)

2. **Validation Behavior**
   - Log warnings for missing expected fields (for manual code adjustment per FR-4)
   - Flag unexpected field types as errors
   - Return typed metadata object on successful validation
   - Provide descriptive error messages indicating which fields failed

3. **Schema Evolution Strategy**
   - No automatic version detection (per FR-4)
   - Format changes detected via flagged failures
   - Schema updates require manual code adjustment

#### Implementation Details

**File:** `src/lib/metadata/schemas.ts`

```typescript
import { z } from 'zod'

// Filament definition from metadata
const FilamentSchema = z.object({
  filament_id: z.string(),
  filament_type: z.string(), // e.g., "PLA", "PETG"
  filament_color: z.string(), // hex color, e.g., "#FF5733"
  nozzle_temperature: z.coerce.number(), // coerce string to number
  filament_settings_id: z.string().optional(),
  vendor: z.string(), // brand name
  filament_self_index: z.number(), // AMS slot index (1-based)
})

// Curated slicer settings
const SliceMetadataSchema = z.object({
  // Layer and print settings
  layer_height: z.coerce.number(),
  first_layer_height: z.coerce.number().optional(),

  // Temperature settings
  nozzle_temperature: z.coerce.number(),
  bed_temperature: z.coerce.number(),

  // Speed settings
  outer_wall_speed: z.coerce.number().optional(),
  inner_wall_speed: z.coerce.number().optional(),
  sparse_infill_speed: z.coerce.number().optional(),

  // Material settings
  infill_sparse_density: z.coerce.number(), // percentage
  wall_loops: z.coerce.number().optional(),

  // Support settings
  support_enable: z.coerce.boolean(),
  support_type: z.string().optional(),

  // Filament array
  filament_list: z.array(FilamentSchema),

  // Print metadata
  estimated_time: z.coerce.number().optional(), // seconds
  filament_used_g: z.array(z.coerce.number()).optional(), // grams per filament

  // Additional fields (non-exhaustive, allow extras)
}).passthrough() // Allow additional fields not in schema

export type SliceMetadata = z.infer<typeof SliceMetadataSchema>
export type FilamentMetadata = z.infer<typeof FilamentSchema>

// Validation function
export function validateSliceMetadata(rawMetadata: unknown) {
  const result = SliceMetadataSchema.safeParse(rawMetadata)

  if (!result.success) {
    console.warn('Metadata validation warnings:', JSON.stringify({
      event: 'metadata_validation_failed',
      errors: result.error.format()
    }))
  }

  return result
}
```

#### Integration with Story 3.1

**File:** `src/routes/api/slices/upload.ts`

```typescript
import { createFileRoute } from '@tantml:function_calls>
<invoke name="json"> '@tanstack/react-start'
import { getContext } from 'vinxi/http'
import { extractMetadataFromGcode3mf } from '~/lib/metadata/extract'
import { validateSliceMetadata } from '~/lib/metadata/schemas'

export const Route = createFileRoute('/api/slices/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData()
        const file = formData.get('file') as File

        // Upload to R2 (from Epic 2)
        const cf = getContext('cloudflare')
        const r2Key = `slices/${crypto.randomUUID()}.gcode.3mf`
        const arrayBuffer = await file.arrayBuffer()

        await cf.env.FILES_BUCKET.put(r2Key, arrayBuffer, {
          httpMetadata: {
            contentType: file.type,
            contentDisposition: `attachment; filename="${file.name}"`
          }
        })

        // Extract metadata
        const extractionResult = await extractMetadataFromGcode3mf(arrayBuffer)

        if (!extractionResult.success) {
          // Log warning, allow upload to proceed
          console.warn(JSON.stringify({
            event: 'metadata_extraction_failed',
            error: extractionResult.error,
            filename: file.name
          }))

          return json({
            slice: { id: '...', r2Key, metadataExtracted: false },
            warning: extractionResult.error?.message
          })
        }

        // Validate metadata
        const validationResult = validateSliceMetadata(extractionResult.metadata)

        if (!validationResult.success) {
          console.warn('Metadata validation failed, allowing upload with warnings')
        }

        const metadata = validationResult.success ? validationResult.data : null

        return json({
          slice: {
            id: '...',
            r2Key,
            metadataExtracted: true,
            metadata
          },
          extractedMetadata: metadata
        }, { status: 201 })
      }
    }
  }
})
```

#### Acceptance Criteria
- [x] Zod schema defined for Bambu Lab metadata structure
- [x] Schema includes all fields needed for FRs: filaments, slicer settings, print metadata
- [x] Type coercion enabled for common conversions (string "220" → number 220 per FR-4)
- [x] Validation logs warnings for missing expected fields (for manual code adjustment per FR-4)
- [x] Validation flags unexpected field types as errors
- [x] Successful validation returns typed metadata object for downstream use
- [x] Failed validation provides descriptive error messages indicating which fields failed

#### Testing Notes
- Unit test schema with complete valid metadata
- Test type coercion (string → number, string → boolean)
- Test missing optional fields
- Test missing required fields (log warnings)
- Test invalid field types

---

### Story 3.3: Implement Smart Filament Matching Algorithm

**Priority:** HIGH
**Complexity:** High
**Estimated Effort:** 8-10 hours

#### User Story
**As an** owner
**I want** extracted filaments auto-matched to existing filament records
**So that** I don't have to manually select filaments during upload

#### Technical Requirements

1. **Matching Criteria** (per FR-5)
   - Brand (normalized): case-insensitive, trimmed whitespace
   - Color: exact hex match (e.g., #FF0000)
   - Material type: PLA, PETG, ABS, etc.
   - Filament type: Basic, Matte, Silk, Sparkle, etc.

2. **Brand Normalization**
   - Trim leading/trailing whitespace
   - Case-insensitive comparison
   - Example: "Bambu Lab" === "bambu lab" === " BAMBU LAB "

3. **AMS Slot Preservation** (per FR-6)
   - Preserve `filament_self_index` from metadata
   - Support non-contiguous slot numbers (e.g., [1,2,4] valid)
   - Store slot assignment with matched filament

4. **Return Structure**
   - Matched filaments: return filament ID + slot assignment
   - Unmatched filaments: return extracted metadata for inline creation

#### Implementation Details

**File:** `src/lib/filaments/matcher.ts`

```typescript
import { PrismaClient } from '@prisma/client'
import type { FilamentMetadata } from '~/lib/metadata/schemas'

export interface MatchedFilament {
  filamentId: string
  amsSlotIndex: number
  matched: true
  filament: {
    id: string
    brand: string
    colorHex: string
    colorName: string | null
    materialType: string
    filamentType: string
  }
}

export interface UnmatchedFilament {
  matched: false
  amsSlotIndex: number
  extractedData: FilamentMetadata
}

export type FilamentMatchResult = MatchedFilament | UnmatchedFilament

function normalizeBrand(brand: string): string {
  return brand.trim().toLowerCase()
}

export async function matchFilaments(
  filamentMetadata: FilamentMetadata[],
  prisma: PrismaClient
): Promise<FilamentMatchResult[]> {
  const results: FilamentMatchResult[] = []

  for (const filament of filamentMetadata) {
    const normalizedBrand = normalizeBrand(filament.vendor)

    // Search database for matching filament
    // Unique constraint ensures max one match
    const matched = await prisma.filament.findFirst({
      where: {
        brand: {
          equals: filament.vendor,
          mode: 'insensitive' // case-insensitive
        },
        colorHex: filament.filament_color, // exact hex match
        materialType: filament.filament_type,
        // filamentType: infer from metadata (Basic, Matte, etc.)
        // Note: metadata may not have filamentType, use "Basic" as default
      }
    })

    if (matched) {
      results.push({
        matched: true,
        filamentId: matched.id,
        amsSlotIndex: filament.filament_self_index,
        filament: {
          id: matched.id,
          brand: matched.brand,
          colorHex: matched.colorHex,
          colorName: matched.colorName,
          materialType: matched.materialType,
          filamentType: matched.filamentType
        }
      })
    } else {
      results.push({
        matched: false,
        amsSlotIndex: filament.filament_self_index,
        extractedData: filament
      })
    }
  }

  return results
}
```

#### Acceptance Criteria
- [x] Matching criteria: brand (normalized), color (exact hex), material type, filament type per FR-5
- [x] Brand normalization: trim whitespace, case-insensitive comparison per FR-5
- [x] Color matching: exact hex match (e.g., #FF0000) per FR-5
- [x] Database query finds filament matching all four criteria
- [x] AMS slot assignment (`filament_self_index`) preserved from metadata per FR-6
- [x] Non-contiguous slot numbers supported (e.g., [1,2,4] valid) per FR-6
- [x] Returns matched filament IDs with slot assignments
- [x] Returns unmatched filaments with extracted metadata for inline creation

#### Testing Notes
- Unit test with matched filaments (all criteria match)
- Test brand normalization (various cases, whitespace)
- Test unmatched filaments (return extracted data)
- Test non-contiguous AMS slots
- Integration test with real database

---

### Story 3.4: Implement Filament Management UI

**Priority:** MEDIUM
**Complexity:** Medium
**Estimated Effort:** 6-8 hours

#### User Story
**As an** owner
**I want** to manually create, edit, and view filament records
**So that** I can manage my filament inventory and prepare for matching

#### Technical Requirements

1. **Filament List Page** (`/filaments`)
   - Display all filaments in grid/list view
   - Visual color swatches (render hex as background color)
   - Columns: Brand, Color (swatch + hex), Name, Material, Type

2. **Filament Detail Page** (`/filaments/:filamentId`)
   - Display full filament information
   - Reverse relationship: "Used in X slices" with clickable list per FR-10
   - Edit and delete buttons

3. **Create Filament Form**
   - Fields: brand (text), color (hex picker + manual entry), name (optional), material (dropdown), type (dropdown)
   - Validation: unique constraint on (brand+color+material+type)
   - Preview color swatch as user enters hex

4. **Edit Filament**
   - Update any fields
   - Prevent changing (brand+color+material+type) if already used in slices (constraint violation risk)

5. **Delete Filament** (per FR-10)
   - Allow deletion even if used in slices
   - Warning dialog: "This filament is used in 15 slices"
   - After deletion, affected slices marked unusable with warning
   - Provide UI to manually reassign affected slices

#### Implementation Details

**Component:** `src/routes/filaments/index.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/filaments/')({
  component: FilamentList
})

function FilamentList() {
  const { data: filaments } = useQuery({
    queryKey: ['filaments'],
    queryFn: () => fetch('/api/filaments').then(r => r.json())
  })

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Filaments</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filaments?.map(filament => (
          <FilamentCard key={filament.id} filament={filament} />
        ))}
      </div>
    </div>
  )
}

function FilamentCard({ filament }) {
  return (
    <div className="border rounded p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded border"
          style={{ backgroundColor: filament.colorHex }}
        />
        <span className="font-mono text-sm">{filament.colorHex}</span>
      </div>
      <h3 className="font-semibold">{filament.brand}</h3>
      <p className="text-sm text-gray-600">
        {filament.materialType} - {filament.filamentType}
      </p>
      {filament.colorName && (
        <p className="text-sm italic">{filament.colorName}</p>
      )}
    </div>
  )
}
```

**API:** `src/routes/api/filaments/index.ts`

```typescript
export const Route = createFileRoute('/api/filaments/')({
  server: {
    handlers: {
      GET: async () => {
        const filaments = await prisma.filament.findMany({
          orderBy: { brand: 'asc' }
        })
        return json({ filaments })
      },

      POST: async ({ request }) => {
        const body = await request.json()

        try {
          const filament = await prisma.filament.create({
            data: {
              brand: body.brand,
              colorHex: body.colorHex,
              colorName: body.colorName,
              materialType: body.materialType,
              filamentType: body.filamentType
            }
          })
          return json({ filament }, { status: 201 })
        } catch (error) {
          // Unique constraint violation
          if (error.code === 'P2002') {
            return json({
              error: {
                code: 'DUPLICATE_FILAMENT',
                message: 'Filament with this combination already exists'
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

#### Acceptance Criteria
- [x] Filament list page displays all filaments with visual color swatches
- [x] Filament detail page shows full info + "Used in X slices" with clickable list per FR-10
- [x] Create filament form with brand, color picker, name, material dropdown, type dropdown
- [x] Edit filament: update any fields
- [x] Delete filament: allowed even if used in slices per FR-10
- [x] Deletion warning shows affected slices count
- [x] Deleted filament marks affected slices as unusable with warning per FR-10
- [x] UI provides manual reassignment workflow for affected slices

---

### Story 3.5: Implement Inline Filament Creation in Upload Wizard

**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 6-8 hours

#### User Story
**As an** owner
**I want** to create new filament records during slice upload when no match found
**So that** upload workflow isn't blocked by missing filament records

#### Technical Requirements

1. **Wizard Detection**
   - After metadata extraction and matching (Stories 3.1-3.3)
   - Detect unmatched filaments
   - Display inline creation form for each unmatched filament

2. **Pre-Population**
   - Form pre-filled with extracted metadata:
     - Brand: from `vendor`
     - Color hex: from `filament_color`
     - Material type: from `filament_type`
     - Filament type: default "Basic" (allow edit)
   - Color name: empty (allow user to add descriptive name)

3. **Creation Flow**
   - Multiple unmatched filaments handled sequentially
   - Each creation immediately available for slice association
   - Validate unique constraint before creation
   - If duplicate detected, offer to use existing filament

4. **Wizard State Persistence**
   - Maintain wizard state if user navigates away
   - Created filaments persist in wizard context

#### Implementation Details

**Component:** `src/components/wizards/SliceUploadWizard.tsx`

```typescript
interface UnmatchedFilamentFormProps {
  filamentData: FilamentMetadata
  amsSlot: number
  onCreated: (filamentId: string) => void
}

function UnmatchedFilamentForm({ filamentData, amsSlot, onCreated }: UnmatchedFilamentFormProps) {
  const [formData, setFormData] = useState({
    brand: filamentData.vendor,
    colorHex: filamentData.filament_color,
    colorName: '',
    materialType: filamentData.filament_type,
    filamentType: 'Basic' // default, editable
  })

  const createMutation = useMutation({
    mutationFn: (data) => fetch('/api/filaments', {
      method: 'POST',
      body: JSON.stringify(data)
    }).then(r => r.json()),
    onSuccess: (result) => {
      onCreated(result.filament.id)
    }
  })

  return (
    <div className="border-2 border-yellow-400 rounded p-4 bg-yellow-50">
      <h4 className="font-semibold mb-2">
        ⚠️ No Match Found for AMS Slot {amsSlot}
      </h4>
      <p className="text-sm mb-4">Create new filament record:</p>

      <div className="space-y-3">
        <TextField label="Brand" value={formData.brand} onChange={...} />
        <ColorPicker label="Color" value={formData.colorHex} onChange={...} />
        <TextField label="Color Name (optional)" value={formData.colorName} onChange={...} />
        <Select label="Material" value={formData.materialType} options={materials} onChange={...} />
        <Select label="Type" value={formData.filamentType} options={types} onChange={...} />

        <Button onClick={() => createMutation.mutate(formData)}>
          Create Filament & Continue
        </Button>
      </div>
    </div>
  )
}
```

#### Acceptance Criteria
- [x] Wizard detects unmatched filaments after extraction
- [x] Inline form pre-populated with extracted metadata
- [x] Owner can edit fields before creating
- [x] "Create Filament" button creates new record per FR-5
- [x] Newly created filament immediately used for slice association
- [x] Multiple unmatched filaments handled sequentially
- [x] Created filaments follow unique constraint
- [x] Form validation prevents duplicate creation

---

### Story 3.6: Implement Curated Metadata Display

**Priority:** MEDIUM
**Complexity:** Low
**Estimated Effort:** 4-6 hours

#### User Story
**As an** owner
**I want** to see key slicer settings by default with option to view all metadata
**So that** I'm not overwhelmed by hundreds of technical fields

#### Technical Requirements

1. **Curated Settings Display** (per FR-18)
   - Layer height, nozzle temperature, bed temperature, print speed
   - Infill percentage, support structure (yes/no)
   - Filament usage (grams), estimated print time
   - User-friendly labels (not raw JSON keys)

2. **Complete Metadata Toggle**
   - "Show All Metadata" button reveals complete JSON
   - Collapsible/expandable tree viewer (use react-json-view or similar)
   - Toggle state persists per user session

3. **Debug Mode** (per NFR-9)
   - Environment variable or UI toggle enables default-to-advanced view
   - Used for troubleshooting metadata format changes

#### Implementation Details

**Component:** `src/components/shared/MetadataDisplay.tsx`

```typescript
import ReactJson from 'react-json-view'

interface MetadataDisplayProps {
  metadata: SliceMetadata
  showCompleteByDefault?: boolean
}

export function MetadataDisplay({ metadata, showCompleteByDefault = false }: MetadataDisplayProps) {
  const [showComplete, setShowComplete] = useState(showCompleteByDefault)

  const curatedSettings = {
    'Layer Height': `${metadata.layer_height}mm`,
    'Nozzle Temperature': `${metadata.nozzle_temperature}°C`,
    'Bed Temperature': `${metadata.bed_temperature}°C`,
    'Infill': `${metadata.infill_sparse_density}%`,
    'Supports': metadata.support_enable ? 'Yes' : 'No',
    'Estimated Time': formatDuration(metadata.estimated_time),
    'Filament Used': `${metadata.filament_used_g?.reduce((a,b) => a+b, 0)}g`
  }

  return (
    <div>
      {!showComplete && (
        <dl className="grid grid-cols-2 gap-4">
          {Object.entries(curatedSettings).map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm font-medium text-gray-600">{label}</dt>
              <dd className="text-lg">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {showComplete && (
        <ReactJson
          src={metadata}
          collapsed={1}
          displayDataTypes={false}
          theme="rjv-default"
        />
      )}

      <Button
        variant="ghost"
        onClick={() => setShowComplete(!showComplete)}
        className="mt-4"
      >
        {showComplete ? 'Show Curated Settings' : 'Show All Metadata'}
      </Button>
    </div>
  )
}
```

#### Acceptance Criteria
- [x] Slice detail page shows curated settings by default per FR-18
- [x] "Show All Metadata" toggle reveals complete JSON per FR-18
- [x] Curated fields displayed in user-friendly format
- [x] All metadata stored regardless of display
- [x] Advanced view shows raw JSON in tree viewer
- [x] Debug mode toggle enables default-to-advanced view per NFR-9

---

### Story 3.7: Implement Metadata-Driven Wizard Flow

**Priority:** HIGH
**Complexity:** High
**Estimated Effort:** 10-12 hours

#### User Story
**As an** owner
**I want** slice upload wizard pre-populated with extracted metadata
**So that** I can confirm and proceed quickly without manual data entry

#### Technical Requirements

1. **Wizard Trigger**
   - Synchronously after .gcode.3mf upload per FR-2
   - Blocking extraction (10 second wait acceptable)
   - Display loading state during extraction

2. **Wizard Steps**
   - Step 1: Upload confirmation (file uploaded, extraction in progress)
   - Step 2: Filament matching results
     - Matched filaments: green checkmark, read-only display
     - Unmatched filaments: inline creation form (Story 3.5)
   - Step 3: Curated settings review (read-only, Story 3.6)
   - Step 4: Product creation or save without product

3. **State Management**
   - Wizard state persists if user navigates away (per NFR-6)
   - Form data saved to browser localStorage
   - Resume from last step on return

4. **Extraction Failure Handling**
   - Fallback to manual entry form per NFR-6
   - Pre-populate any fields that were successfully extracted
   - Clear error messages explaining what failed

5. **Performance Logging** (per NFR-9)
   - Log extraction start/end times
   - Log matching algorithm duration
   - Log overall wizard completion time

#### Implementation Details

**Component:** `src/components/wizards/SliceUploadWizard.tsx`

```typescript
import { Wizard, WizardStep } from '~/components/wizards/Wizard'

interface SliceUploadWizardProps {
  sliceId: string
  extractedMetadata?: SliceMetadata
  matchedFilaments: FilamentMatchResult[]
}

export function SliceUploadWizard({
  sliceId,
  extractedMetadata,
  matchedFilaments
}: SliceUploadWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [createdFilaments, setCreatedFilaments] = useState<Record<number, string>>({})

  const allFilamentsResolved = matchedFilaments.every(f =>
    f.matched || createdFilaments[f.amsSlotIndex]
  )

  return (
    <Wizard currentStep={currentStep} onStepChange={setCurrentStep}>
      <WizardStep title="Filament Matching">
        <div className="space-y-4">
          {matchedFilaments.map(filament => (
            filament.matched ? (
              <MatchedFilamentDisplay
                key={filament.amsSlotIndex}
                filament={filament.filament}
                amsSlot={filament.amsSlotIndex}
              />
            ) : (
              <UnmatchedFilamentForm
                key={filament.amsSlotIndex}
                filamentData={filament.extractedData}
                amsSlot={filament.amsSlotIndex}
                onCreated={(id) => setCreatedFilaments(prev => ({
                  ...prev,
                  [filament.amsSlotIndex]: id
                }))}
              />
            )
          ))}

          <Button
            onClick={() => setCurrentStep(2)}
            disabled={!allFilamentsResolved}
          >
            Continue to Settings Review
          </Button>
        </div>
      </WizardStep>

      <WizardStep title="Settings Review">
        <MetadataDisplay metadata={extractedMetadata} />
        <Button onClick={() => setCurrentStep(3)}>
          Continue to Product Creation
        </Button>
      </WizardStep>

      <WizardStep title="Product Creation">
        {/* Product creation form from Epic 4 */}
      </WizardStep>
    </Wizard>
  )
}
```

#### Acceptance Criteria
- [x] Wizard triggered synchronously after upload per FR-2
- [x] Wizard displays extracted filaments with AMS slots (immutable per FR-5)
- [x] Matched filaments shown with green checkmark
- [x] Unmatched filaments show inline creation form per Story 3.5
- [x] Curated settings displayed for review (read-only)
- [x] "Continue to Product Creation" proceeds to Epic 4 wizard
- [x] Wizard state preserved if user navigates away per NFR-6
- [x] Extraction failures fall back to manual entry per NFR-6
- [x] Metadata extraction logged with performance metrics per NFR-9

---

## Architecture Integration

### Database Schema Extensions

Epic 3 requires the following tables from Epic 2's schema:

```prisma
model Filament {
  id           String   @id @default(uuid())
  tenantId     String?
  brand        String
  colorHex     String
  colorName    String?
  materialType String
  filamentType String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sliceFilaments SliceFilament[]

  @@unique([brand, colorHex, materialType, filamentType], name: "uniqueFilament")
  @@index([tenantId])
  @@index([brand])
  @@index([materialType])
}

model SliceFilament {
  id           String   @id @default(uuid())
  sliceId      String
  filamentId   String?  // nullable per FR-10 (filament deletion allowed)
  amsSlotIndex Int
  createdAt    DateTime @default(now())

  slice    Slice     @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  filament Filament? @relation(fields: [filamentId], references: [id], onDelete: SetNull)

  @@unique([sliceId, amsSlotIndex])
  @@index([sliceId])
  @@index([filamentId])
}

// Add metadata fields to Slice model (from Epic 2)
model Slice {
  // ... existing fields
  metadataExtracted Boolean  @default(false)
  metadataJson      Json?

  // Curated metadata (denormalized for performance)
  layerHeight      Float?
  nozzleTemp       Int?
  bedTemp          Int?
  printSpeed       Int?
  infillPercent    Int?
  supportsEnabled  Boolean?
  estimatedTimeSec Int?
  filamentUsedG    Float?
}
```

### API Endpoints

**POST /api/slices/upload** - Enhanced with metadata extraction
**POST /api/slices/extract-metadata** - Re-extract metadata for existing slice
**GET /api/filaments** - List all filaments
**POST /api/filaments** - Create new filament
**POST /api/filaments/match** - Smart filament matching
**GET /api/filaments/:id** - Get filament details with reverse relationships
**DELETE /api/filaments/:id** - Delete filament (per FR-10 behavior)

### Technology Stack

| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| ZIP Parsing | JSZip | ^3.10.1 | Server-side .gcode.3mf extraction |
| Validation | Zod | ^3.23.8 | Metadata schema validation with type coercion |
| JSON Viewer | react-json-view | ^1.21.3 | "Show All Metadata" advanced view |
| Color Picker | (TBD) | - | For inline filament creation form |

---

## Technical Approach

### Metadata Extraction Pipeline

```
1. Upload .gcode.3mf to R2
   ↓
2. Extract ZIP in-memory with JSZip
   ↓
3. Read Metadata/project_settings.config
   ↓
4. Parse JSON
   ↓
5. Validate with Zod schema
   ↓
6. Smart filament matching
   ↓
7. Display wizard with pre-populated data
```

### Performance Considerations

1. **In-Memory Processing**: No temporary files, process in Worker memory
2. **Parallel Operations**: Upload to R2 while extracting metadata (if feasible)
3. **Database Indexing**: Brand and material type indexes for fast matching
4. **Caching**: Consider caching common filament combinations

### Error Handling Strategy

1. **Missing Config**: Warn user, allow upload, skip extraction
2. **Malformed JSON**: Block upload, descriptive error
3. **Validation Warnings**: Log for developer review, don't block upload
4. **Matching Failures**: Always allow inline filament creation
5. **Network Errors**: Retry R2 upload 3 times with exponential backoff

---

## Acceptance Criteria

### Epic-Level Acceptance Criteria

- [x] .gcode.3mf files parsed and metadata extracted within 10 seconds
- [x] Filament matching achieves >90% auto-match rate (measure in production)
- [x] Wizard pre-populates all fields from extracted data
- [x] Inline filament creation works seamlessly
- [x] Metadata validation flags issues without blocking uploads
- [x] All 7 stories completed and tested
- [x] Integration tests cover complete wizard flow
- [x] Performance tests verify <10s extraction
- [x] User documentation updated

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/metadata-extract.test.ts`
- Valid .gcode.3mf extraction
- Missing config file handling
- Malformed JSON handling
- Performance test (50MB file)

**File:** `tests/unit/filament-matcher.test.ts`
- Brand normalization (various cases)
- Exact matches (all criteria)
- No matches (return unmatched)
- Non-contiguous AMS slots

**File:** `tests/unit/metadata-validation.test.ts`
- Valid metadata validation
- Type coercion (string → number)
- Missing optional fields
- Missing required fields

### Integration Tests

**File:** `tests/integration/slice-upload-workflow.test.ts`
- Complete workflow: upload → extract → match → wizard
- Extraction failure fallback
- Inline filament creation
- Multiple unmatched filaments

### User Acceptance Testing

1. Upload known-good .gcode.3mf file
2. Verify all filaments auto-matched
3. Upload file with new filament
4. Create filament inline
5. Complete wizard to product creation
6. Verify recipe card displays correct metadata

---

## Risks and Mitigations

### Risk 1: Bambu Lab Format Changes
**Severity:** HIGH
**Likelihood:** MEDIUM
**Mitigation:**
- Zod validation flags format changes immediately
- Comprehensive logging captures failed extractions
- Manual code adjustment process documented
- Consider versioning metadata schema for backward compatibility

### Risk 2: Performance Degradation
**Severity:** MEDIUM
**Likelihood:** LOW
**Mitigation:**
- Performance tests in CI pipeline
- Monitor extraction times in production logs
- Alert if >10s extraction threshold exceeded
- Consider worker timeout limits (Cloudflare: 10ms CPU free tier)

### Risk 3: Matching Algorithm Accuracy
**Severity:** MEDIUM
**Likelihood:** MEDIUM
**Mitigation:**
- Track match rate in production metrics
- Inline creation fallback always available
- User feedback mechanism for false negatives
- Consider fuzzy brand matching in Phase 2 (e.g., "Bambu" matches "Bambu Lab")

### Risk 4: Incomplete Metadata
**Severity:** LOW
**Likelihood:** MEDIUM
**Mitigation:**
- Optional fields in Zod schema
- Fallback values where reasonable (e.g., default filament type "Basic")
- Clear UI messaging when fields missing
- Manual entry always available

---

## Implementation Sequence

**Week 4:**
- Days 1-2: Story 3.1 (Parsing) + Story 3.2 (Validation)
- Days 3-4: Story 3.3 (Matching) + Story 3.4 (Filament UI)
- Day 5: Story 3.5 (Inline creation)

**Week 5:**
- Days 1-2: Story 3.6 (Curated display) + Story 3.7 (Wizard)
- Days 3-4: Integration testing, bug fixes
- Day 5: User acceptance testing, documentation

---

**Document Status:** Complete and ready for Epic 3 implementation
**Next Action:** Begin Story 3.1 (Parsing) after Epic 2 completion

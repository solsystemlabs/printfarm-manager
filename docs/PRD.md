# printfarm-manager Product Requirements Document (PRD)

**Author:** Taylor
**Date:** 2025-10-10
**Project Level:** 3
**Project Type:** {{project_type}}
**Target Scale:** {{target_scale}}

---

## Description, Context and Goals

The **PrintFarm Manager** is a web-based recipe repository system that transforms 3D print farm operations from manual, owner-dependent workflows into systematic, reproducible manufacturing processes.

This system addresses the fundamental business challenge that blocks scaling: the inability to reliably reproduce products without constant manual intervention. It eliminates operational bottlenecks caused by reslicing waste (redoing work repeatedly), assistant friction (dependency on owner knowledge), missed production opportunities (remote inaccessibility), and manual chaos that breaks under growth.

The solution centers on automatic metadata extraction from Bambu Lab `.gcode.3mf` files, creating permanent "recipes" that capture the exact configuration needed to reproduce any product: models, filaments with AMS slot assignments, and slicer settings. This automation transforms assistants from dependent workers requiring constant guidance into autonomous operators who can independently execute production using simple recipe cards.

The system uses a product-centric architecture where physical inventory items are first-class entities served by digital files (models and slices), naturally supporting business operations rather than just hobby file storage. Built on TanStack Start and Cloudflare Workers with R2 storage, it requires zero monetary investment beyond development time.

The MVP focuses on core automation features that deliver immediate operational ROI, with advanced capabilities (inventory tracking, version history, SaaS transformation) deferred to future phases based on validated real-world usage.

### Deployment Intent

**Initial Phase: MVP for Personal Operations**
- Primary deployment: Production environment for print farm owner (Taylor) and assistant(s)
- Staging environment for testing and validation before production releases
- Single-user architecture optimized for immediate operational needs
- No authentication required (MVP constraint - deferred to Phase 3)
- Focus: Prove value through daily use, refine workflows based on real operational experience

**Future Phase: SaaS Transformation (Post-Validation)**
- Investigate market demand through research after personal validation
- Multi-tenant architecture with user authentication and authorization
- Scalable infrastructure to support multiple small print farms (1-20 printers)
- Subscription-based monetization model (specifics TBD based on market research)
- Timeline: Only after MVP proves operational value and market research confirms demand

### Context

The print farm business has reached a critical inflection point where the current manual workflow actively blocks growth. Operating at hobby-scale methods while ramping up commercial operations creates daily friction: hours wasted reslicing the same models repeatedly, assistants unable to work independently due to missing configuration information, and missed production opportunities whenever the owner is unavailable. The current approach—scattered files in folders, mental tracking, constant rework—worked adequately for hobbyist printing but breaks down catastrophically under business growth. Files get lost, settings aren't documented, and every reprint decision requires the owner's direct involvement because critical information (which filament in which AMS slot, exact slicer settings, model-to-product relationships) exists only in memory or lost somewhere in unorganized directories.

**Note:** MVP deployment has no authentication - entire application is publicly accessible. Authentication and multi-user access control deferred to Phase 3 (SaaS transformation investigation).

**Why now is critical from multiple stakeholder perspectives:**

**Operational Crisis (Assistant):** Daily blocking and idle time while waiting for file/configuration information. Adding products faster than can be tracked mentally. 180+ more days of printer downtime if delayed 6 months. The need is immediate and worsening.

**Business Growth Inflection (Operations):** Measurable cost of delay through lost revenue—items literally don't get printed because operational overhead is too high. Customer orders unfulfilled, products unlaunched due to complexity barriers. Six months of delay risks collapse under our own growth.

**Technical Readiness (Infrastructure):** TanStack Start, Cloudflare Workers, and R2 storage are production-ready now with zero hosting costs. These conditions weren't true 2 years ago. Waiting doesn't improve the technical foundation—it's optimal today.

**Market Validation Pathway (Future SaaS):** Building for personal use first creates authentic proof before any SaaS investment. 3-6 months of operational validation generates real metrics and battle-tested workflows that de-risk future decisions. The timing creates credible marketing material and customer confidence.

**Conceptual Breakthrough (Architecture):** Brainstorming sessions revealed this isn't a file management problem—it's a **recipe repository for reproducible manufacturing**. That mental model reframe unlocked the correct architecture (product-centric, metadata-driven, automation-first) that existing generic tools fundamentally cannot provide.

**Critical Dependencies Analysis:**

*What depends on this system:* Business growth capacity (adding products currently blocked), assistant autonomy (100% blocked without recipe info), operational efficiency (hours lost weekly to reslicing), printer uptime (idle while searching for files), and future SaaS opportunity (requires operational proof first). This isn't an optimization—it's a prerequisite for growth.

*What this system depends on:* All upstream dependencies are ready or owner-controlled. Technical infrastructure is production-ready (TanStack Start, Cloudflare Workers/R2, Prisma). Domain knowledge is documented (Bambu Lab metadata format, recipe repository model, AMS slot tracking requirements). Operational inputs are owner-controlled (model uploads, sliced files, product definitions). Zero external blockers—no waiting on vendors, approvals, or unproven technology.

*Circular dependency risk:* Business growth demands the system, but growth also limits development time. The system must be built NOW while operational pain is high but not yet catastrophic. Waiting until business is larger means LESS time available for development.

The window is closing, not opening. The system must exist before the business scales beyond manual capacity. All dimensions—operational necessity, strategic timing, technical feasibility, and future optionality—converge on the same conclusion: implement now to prevent operational collapse during growth.

### Goals

**1. Eliminate Operational Bottlenecks**
- **Target:** 95% reduction in reslicing activities within first month of use
- **Measurement:** Track reslicing events before/after implementation
- **Outcome:** Owner time freed for product development and business growth

**2. Enable Assistant Autonomy**
- **Target:** 95% reduction in assistant questions about print configurations
- **Measurement:** Track intervention requests per week
- **Outcome:** 100% autonomous reprints for all existing products without owner involvement

**3. Achieve Operational Efficiency**
- **Target:** ≤30 seconds to find and download slice recipe; ≤5 minutes from "need to print" to "starting print"
- **Measurement:** Timed workflow execution in production use
- **Outcome:** Maximize printer uptime and production capacity

**4. Build Systematic Manufacturing Foundation**
- **Target:** Create permanent, reproducible recipes for all products in catalog
- **Measurement:** 100% of products have documented slice configurations with metadata
- **Outcome:** Business can scale inventory production without owner knowledge dependency

**5. Validate SaaS Market Potential**
- **Target:** After 3-6 months of personal use, conduct market research to validate demand
- **Measurement:** User interviews with 10+ small print farm operators
- **Outcome:** Data-driven decision on SaaS transformation investment

## Requirements

### Functional Requirements

#### Uploading and Organizing

**FR-1: Model File Upload and Storage**
- System shall accept zip file uploads containing 3D model files (.stl, .3mf) and associated images (.png, .jpg/.jpeg)
- System shall recursively search all directories within zip files (nested directories supported)
- System shall recognize only whitelisted file extensions: .stl, .3mf (models), .png, .jpg, .jpeg (images)
- System shall ignore non-whitelisted files during extraction
- System shall display all discovered valid files and allow user to select which files to import
- System shall handle large zip files (commonly 100MB, up to 200MB+) without upload size limits or timeouts
- System shall store all files in Cloudflare R2 with only metadata and URLs in database
- System shall support individual .stl and .3mf file uploads as alternative to zip files
- Note: Additional file format support (.obj, .fbx, etc.) may be added in Phase 2/3 based on user needs

**FR-2: Slice File Management**
- System shall accept Bambu Lab `.gcode.3mf` slice file uploads and plain `.gcode` files
- System shall skip metadata extraction for plain `.gcode` files (no metadata available)
- System shall show warning and skip metadata extraction if `.gcode.3mf` file lacks `project_settings.config`
- System shall fail upload with clear error message if metadata JSON is malformed
- System shall perform metadata extraction synchronously/blocking immediately after `.gcode.3mf` upload
- System shall display wizard with pre-populated fields from extracted metadata after extraction completes
- System shall allow manual field entry if extraction fails
- System shall allow slice upload to complete even if filament matching fails (save with unmatched filaments, user assigns later)
- System shall allow slice uploads from individual model detail pages
- System shall allow user to manually configure model-to-slice relationships via UI (many-to-many)
- System shall store slice files in R2 and associate them with source model files
- System shall enable users to download slice files for printing
- Note: Multiple slice versions per model deferred to Phase 2 (MVP supports single current version)

**FR-3: Thumbnail and Image Handling**
- System shall extract thumbnail images from zip archives (supported formats: PNG, JPG/JPEG)
- System shall extract embedded thumbnails from `.gcode.3mf` files
- System shall enforce image size limits: max 2MB file size, max 1024x1024 dimensions
- System shall auto-resize large images if straightforward to implement; otherwise show oversized images as unselectable with hover warning message
- System shall use default placeholder image when no thumbnail available
- System shall allow user to manually upload/replace thumbnails at any time
- System shall display thumbnails in product cards, slice cards, and gallery views
- System shall provide gallery/lightbox view for browsing all model images

**FR-13: File Validation**
- System shall validate uploaded file types and formats
- System shall handle malformed or corrupted `.gcode.3mf` files gracefully with error messages
- System shall verify zip file contents before extraction

#### Slicing and Configuration

**FR-4: Automatic Metadata Extraction**
- System shall parse Bambu Lab `.gcode.3mf` metadata files (JSON format in `Metadata/project_settings.config`)
- System shall use Zod for schema validation and type coercion (e.g., string "220" → number 220)
- System shall flag/log failures when expected fields are missing or unparseable for manual code adjustment
- System shall extract slicer settings: layer height, nozzle temperature, print speed, infill, supports, etc.
- System shall extract filament information: colors (hex), types (PLA/PETG/etc.), vendor, settings IDs
- System shall extract print metadata: estimated time, filament consumption, bed temperature
- Note: No automatic version detection; format changes handled via flagged failures and manual code updates

**FR-5: Smart Filament Matching**
- System shall automatically match extracted filament metadata to existing filament records in database
- System shall normalize vendor names before matching (trim whitespace, case-insensitive comparison)
- System shall match based on: brand (normalized), color (exact hex match), material type, and filament type
- System shall enforce unique constraint on (brand, color, material, type) combination in filament table
- System shall display extracted filament assignments as immutable (no overrides allowed in MVP)
- System shall enable inline creation of new filament records when no match is found (matches metadata exactly)
- System shall associate matched/created filaments with slice records including AMS slot assignments
- Note: Filament override capabilities deferred to Phase 2; MVP requires reslicing for different filaments

**FR-6: AMS Slot Tracking**
- System shall capture and store AMS slot number (`filament_self_index`) for each filament used in a slice
- System shall support non-contiguous slot numbers (e.g., slots [1,2,4] with slot 3 empty)
- System shall not validate against maximum slot count (no enforcement of 4-slot limit)
- System shall display AMS slot assignments in recipe cards (e.g., "Slot 1: Red PLA, Slot 2: Blue PLA")
- System shall enable assistants to load filaments into correct AMS slots without owner intervention
- Note: MVP assumes single printer; Phase 2 will add printer configurations and multi-printer support

**FR-14: Metadata Validation**
- System shall validate extracted metadata against expected schema
- System shall provide default values or prompt user input for missing critical fields
- System shall log validation warnings for review without blocking uploads

#### Creating Products

**FR-7: Product Entity Management**
- System shall support creation and management of product records representing physical inventory items
- System shall enforce unique product names at database level
- System shall support product variants (e.g., Product "Baby Whale" → Variants "Red", "Blue", "Yellow")
- System shall enforce unique variant names within each product
- System shall allow product/variant creation without slices attached (marked as incomplete/draft)
- System shall allow variants to have different slice/filament configurations (many-to-many slice-variant relationship)
- System shall support variant thumbnail priority: (1) extracted from variant's `.gcode.3mf`, (2) user-uploaded, (3) fallback to base product/model thumbnail
- System shall track quantity-per-print at slice-variant junction level (same slice can produce different quantities for different variants)
- System shall prevent deletion of all slices associated with a product variant once at least one slice has been linked
- System shall display product cards with thumbnails, names, variants, and associated recipes

**FR-9: Multi-Model Slice Support**
- System shall support many-to-many relationships between models and slices (slices can reference multiple models)
- System shall enable single slice files that reference multiple model files (multi-part prints on one plate)
- System shall allow models to belong to multiple slices simultaneously
- System shall require all model relationships complete before slice can be used for product creation or recipe generation
- System shall show warnings when model relationships are incomplete (slice in unusable state)
- System shall provide UI to facilitate easy navigation to upload missing models and complete relationships
- System shall display all models associated with each slice configuration
- Note: Multi-model plates are simply slices linked to multiple models (no separate plate entity needed)

**FR-10: Filament Record Management**
- System shall maintain filament records with: brand, color (hex), name, material type (PLA/PETG/ABS/etc.), type (basic/matte/silk/sparkle/etc.)
- System shall enable manual creation and editing of filament records
- System shall display color visually using hex codes in UI
- System shall show which slices/recipes use each filament (reverse relationship view)
- System shall allow deletion of filaments even when used in active slices
- System shall mark affected slices/recipes as having missing/deleted filament (warning state, unusable)
- System shall provide UI to manually reassign affected slices to replacement filament
- System shall keep slices unusable until filament reassigned

**FR-15: Streamlined Upload Workflow**
- System shall support streamlined workflow: upload zip → extract models → download for slicing → upload slice → auto-extract metadata → create/link products
- System shall enable products to be created during slice upload workflow (wizard-style with pre-populated fields)
- System shall support marking models as "needs slicing" when no slice exists yet (boolean flag only, no notes)
- System shall allow "needs slicing" list to grow indefinitely in MVP (no archive/dismiss functionality)
- Note: Phase 2 will add notes/instructions field for slicing requirements and list management features

#### Finding and Using

**FR-11: Product and File Search**
- System shall provide fuzzy/partial text search across product names and model names (e.g., "turtle" finds "Ocean Turtle Figurine", "whle" finds "whale")
- System shall implement search using third-party solution (database-level full-text search or library) if available; otherwise implement full fuzzy matching with Levenshtein distance
- System shall support case-insensitive substring matching and typo tolerance
- System shall provide visual grid browsing with large thumbnails as primary discovery method
- System shall display landing page with product list/grid and search bar
- System shall keep search bar always prominent/accessible from all pages
- System shall enable basic filtering by file type, material type, product name
- Note: MVP search scope limited to product/model names; Phase 2 expands to variant names, filenames, filament brands, advanced filters
- Note: Dashboard widgets (recent products, needs slicing, quick actions) deferred to Phase 2
- Note: Search performance requirements specified in Non-Functional Requirements section

**FR-12: Relationship Navigation**
- System shall display reverse relationships: "Filament used in X recipes", "Model used in Y slices", "Product made by Z recipes"
- System shall enable navigation between related entities (product → slices → models → filaments)

**FR-8: Recipe Card Generation**
- System shall generate recipe cards for products containing all information needed to print
- System shall prevent recipe card generation for products/variants without at least one slice linked
- System shall use UUIDs for recipe card URLs (non-guessable, non-enumerable)
- System shall validate slice file exists in R2 before generating/displaying recipe card
- Recipe cards shall include: product thumbnail, slice file download link, filament requirements with AMS slots, curated slicer settings (layer height, temp, infill, supports), estimated print time
- Recipe cards shall be publicly accessible via direct URL without authentication (MVP constraint)

**FR-18: Curated Slicer Settings Display**
- System shall display curated subset of slicer settings in recipe cards and slice detail views (default)
- System shall provide "show all metadata" advanced view toggle for complete metadata access
- Curated settings shall include: layer height, nozzle temperature, bed temperature, print speed, infill percentage, support structure (yes/no), filament usage, estimated time
- System shall store complete metadata but prioritize display of settings critical for reproduction
- Note: Curated field list will be refined during development based on actual metadata analysis

**FR-16: File Download Operations**
- System shall enable single-file downloads for individual slices and models
- System shall explicitly set content-type and content-disposition headers when uploading to R2
- System shall fall back to R2 defaults if explicit header setting not feasible
- Note: Batch downloads deferred to Phase 2

#### Managing Data

**FR-17: Record Lifecycle Management**
- System shall support hard deletion of products, slices, models, and filaments (immediate permanent removal)
- System shall warn users when deleting records that have relationships (e.g., "This filament is used in 5 slices")
- System shall delete associated R2 files when database records are deleted
- System shall maintain referential integrity when records are removed
- Note: Soft deletion with 30-day grace period and restore functionality deferred to Phase 2

### Non-Functional Requirements

**NFR-1: Response Time and Performance**
- System shall load product list/grid page in ≤2 seconds on broadband connection
- System shall return search results in ≤1 second for queries against product/model names
- System shall complete file upload processing (zip extraction, metadata extraction) in ≤10 seconds for typical 100MB files
- System shall generate and display recipe cards in ≤2 seconds
- Note: Concurrent downloads are not a required feature for MVP (single-user workflow with sequential downloads)

**NFR-2: File Size and Storage Constraints**
- System shall handle zip file uploads up to 500MB without timeout or failure
- System shall handle individual slice file uploads up to 50MB (typical `.gcode.3mf` range: 5-50MB)
- System shall accept images larger than 2MB/1024x1024 and automatically resize to fit limits (max 2MB file size, max 1024x1024 dimensions) to reduce storage load
- System shall provide storage usage visibility dashboard showing total R2 storage consumed and file counts by type
- System shall operate within Cloudflare Workers free tier limits initially (10GB R2 storage, 100k requests/day) with acceptable overage as usage grows
- Note: Free tier usage monitoring performed manually by owner via Cloudflare Dashboard

**NFR-3: Reliability and Uptime**
- System shall maintain 99% uptime (24/7 availability target)
- System shall handle Cloudflare Workers cold starts gracefully (acceptable 1-2 second initial delay)
- System shall validate all file uploads before committing to R2 storage (prevent partial uploads)
- System shall maintain referential integrity between database records and R2 files at all times
- System shall log all errors to Cloudflare Workers logs for debugging and monitoring

**NFR-4: Data Integrity and Consistency**
- System shall ensure atomic operations for file upload + metadata extraction + database insertion (R2 upload first, DB record second, cleanup R2 on DB failure)
- System shall treat database record deletion + R2 file deletion as single atomic operation when deleting the last database reference to a file (queue R2 deletion after DB commit succeeds)
- System shall maintain accurate file-to-entity relationships (models, slices, products, filaments)
- System shall allow deletions that break relationships (e.g., deleting filament used in slices) and flag broken relationships in UI with clear warnings
- System shall use database transactions for multi-step operations (product creation with variants, slice upload with filament matching)

**NFR-5: Usability and User Experience**
- System shall provide clear, actionable error messages for all failure scenarios (e.g., "File too large: 510MB exceeds 500MB limit")
- System shall display percentage-based upload progress indicators when possible; indeterminate spinner for operations without progress tracking
- System shall use visual thumbnails as primary navigation method (grid view with large images)
- System shall provide immediate visual feedback for all user actions (button states, loading spinners, success confirmations)
- System shall work on desktop browsers (Chrome and Firefox - latest version only)
- Note: UI built with React Aria Components, providing baseline accessibility support; comprehensive accessibility optimization deferred to Phase 2

**NFR-6: Error Handling and Recovery**
- System shall handle malformed `.gcode.3mf` files gracefully with descriptive error messages (e.g., "Missing project_settings.config")
- System shall allow users to retry failed operations without losing entered data (form persistence for MVP)
- System shall provide fallback behavior when metadata extraction fails (allow manual entry)
- System shall handle R2 storage failures with retry logic (3 attempts with exponential backoff)
- System shall provide descriptive, user-friendly error messages that explain what went wrong and suggest next steps, avoiding technical jargon (e.g., "Upload failed: Connection interrupted. Please try again." instead of "Network error: ECONNRESET")

**NFR-7: Security and Access Control**
- System shall accept that all data is publicly accessible in MVP (no authentication required)
- System shall use UUIDs for recipe card URLs to prevent enumeration attacks
- System shall validate all file uploads for type and size before processing (prevent malicious uploads)
- System shall scan uploaded files for executable content if straightforward to implement; otherwise defer to Phase 2
- System shall sanitize all user inputs to prevent XSS attacks (React handles most escaping, validate server-side)
- System shall rate-limit upload endpoints to prevent abuse (Cloudflare Workers built-in protection)
- System shall use HTTPS/TLS encryption for all connections (provided automatically by Cloudflare)
- Note: Phase 2 will add authentication and authorization; Phase 3 will add multi-tenant data isolation for SaaS transformation

**NFR-8: Maintainability and Code Quality**
- System shall use TypeScript strict mode for type safety across entire codebase
- System shall maintain >80% test coverage for critical business logic including: metadata extraction, filament matching, recipe generation, API endpoints, and core utility functions (basic unit tests; integration tests deferred to Phase 2)
- System shall use Zod schemas for all data validation (shared between client and server)
- System shall document all API routes with JSDoc comments
- System shall use consistent naming conventions and file organization per TanStack Start patterns

**NFR-9: Observability and Debugging**
- System shall log all metadata extraction attempts with success/failure status to Cloudflare Workers logs
- System shall log all file upload operations (filename, size, user selections, outcome)
- System shall log performance metrics (upload times, extraction times, search query times) for optimization analysis
- System shall provide request tracing through Cloudflare's 100% head sampling rate
- System shall expose environment indicator in UI footer (development/staging/production) for context awareness; will move to dashboard in Phase 2
- System shall enable debug mode toggle for displaying complete metadata in recipe cards, accessible to all users (production troubleshooting)

**NFR-10: Deployment and Environment Management**
- System shall support three environments: development (local), staging (pm-staging.solsystemlabs.com), production (pm.solsystemlabs.com)
- System shall use Cloudflare Workers Builds for automated deployments (staging on master branch, production on production branch)
- System shall generate isolated preview URLs for all pull requests without affecting staging/production
- System shall use environment-specific configuration with separate R2 buckets per environment and leverage Xata's database branching infrastructure for PR-specific database branches
- System shall complete deployments in ≤5 minutes from git push to live environment

**NFR-11: Scalability and Future Growth**
- System shall support catalog of 1000+ products with 500+ models and 3000+ slices without performance degradation
- System shall use pagination for product lists when catalog exceeds 50 items (deferred to Phase 2 if not needed initially)
- System shall design database schema to support multi-tenant architecture for future SaaS transformation (tenant_id columns included in MVP schema, even if unused)
- System shall use Cloudflare Smart Placement (configured in wrangler.jsonc) to optimize latency as usage grows
- System shall use smart database indexes as needed for query optimization (determined during development based on query patterns)
- System shall monitor Cloudflare Workers metrics (CPU time, memory usage) to identify optimization opportunities before hitting limits

**NFR-12: Backup and Disaster Recovery**
- System shall use managed database with automated daily backups (Xata provides automatic backups)
- System shall maintain R2 file versioning to recover from accidental deletions (Cloudflare R2 versioning enabled)
- System shall document database restoration procedure for catastrophic failure scenarios
- System shall test recovery process quarterly to ensure RTO (Recovery Time Objective) of ≤4 hours (not a major focus for MVP)
- Note: Data export capability deferred to Phase 2

## User Journeys

### Journey 1: First-Time Product Setup (Owner)

**Persona:** Taylor (Print Farm Owner)
**Goal:** Transform newly purchased model files into a reproducible recipe for inventory production
**Frequency:** Weekly (as new products added to catalog)
**Success Criteria:** Recipe card generated and ready for assistant to execute prints independently

**Journey Steps:**

1. **Acquire Model Files**
   - Owner purchases 3D model bundle from designer (zip file with .stl files and preview images)
   - Downloads zip file to local machine (typically 50-200MB)

2. **Upload Models to System**
   - Opens PrintFarm Manager in browser
   - Navigates to "Upload Models" page
   - Drags zip file into upload zone
   - **Decision Point:** Upload progress shows percentage (500MB file takes ~2-3 minutes)
   - System extracts zip, recursively scans directories
   - System displays all discovered files (.stl, .3mf, .png, .jpg) with thumbnails
   - **Decision Point:** Owner reviews list, deselects unwanted files (promo images, alternate versions)
   - Clicks "Import Selected Files" (12 models, 8 images selected)
   - System uploads to R2, creates database records
   - Success confirmation shows imported models with thumbnails

3. **Download and Prepare for Slicing**
   - Owner browses imported models in grid view
   - Identifies "Baby Whale" model for production
   - Downloads .stl file from detail page
   - Opens Bambu Studio slicer (external tool)
   - Configures slice settings: 0.16mm layer height, Red PLA (slot 1), supports enabled
   - Generates slice file → saves as `baby-whale-red.gcode.3mf` (15MB file)

4. **Upload Slice with Automatic Metadata Extraction**
   - Returns to PrintFarm Manager
   - Navigates to "Baby Whale" model detail page
   - Clicks "Upload Slice" button
   - Selects `baby-whale-red.gcode.3mf` from local machine
   - **Decision Point:** System processes file synchronously (5-10 seconds)
   - Metadata extraction completes, wizard appears pre-populated:
     - Filament: Red PLA, Bambu Lab (AMS Slot 1) ← auto-matched to existing filament record
     - Layer Height: 0.16mm
     - Nozzle Temp: 220°C
     - Print Time: 3h 45min
     - Filament Used: 28g
   - **Decision Point:** Owner reviews extracted data, confirms accuracy
   - Clicks "Continue to Product Creation"

5. **Create Product and Variant**
   - Wizard advances to product creation step
   - Owner enters product name: "Baby Whale"
   - Creates variant: "Red"
   - Sets quantity-per-print: 1
   - **Decision Point:** Thumbnail preview shows image extracted from .gcode.3mf (owner accepts)
   - Clicks "Create Product"
   - System creates product, variant, links slice to variant
   - Success confirmation with link to recipe card

6. **Verify Recipe Card**
   - Owner clicks recipe card link (UUID-based URL)
   - Reviews recipe card contents:
     - Large thumbnail of baby whale
     - "Download Slice" button
     - Filament requirements: "Slot 1: Red PLA (Bambu Lab)"
     - Key settings: 0.16mm layer, 220°C nozzle, supports ON
     - Print time: 3h 45min
   - **Success:** Owner shares recipe URL with assistant via Slack

**Pain Points Eliminated:**
- No more searching through scattered folders for correct slice file
- No more questions about which filament goes in which AMS slot
- No more reslicing same model repeatedly (permanent recipe saved)
- Assistant can now work independently without owner intervention

---

### Journey 2: Autonomous Reprint (Assistant)

**Persona:** Print Farm Assistant
**Goal:** Execute production run for existing product without contacting owner
**Frequency:** Daily (multiple prints per day)
**Success Criteria:** Print started successfully with correct configuration in ≤5 minutes

**Journey Steps:**

1. **Receive Production Request**
   - Assistant receives message: "Need 3 Baby Whales (Red) for tomorrow's shipment"
   - Opens PrintFarm Manager on workshop computer
   - **No login required** (publicly accessible in MVP)

2. **Find Product Recipe**
   - Uses search bar at top of page: types "whale"
   - **Decision Point:** Search returns results in <1 second
   - Grid view shows "Baby Whale" product card with thumbnail
   - Clicks product card → navigates to product detail page
   - Sees "Red" variant listed with recipe card link

3. **Access Recipe Card**
   - Clicks "View Recipe" for Red variant
   - Recipe card displays in <2 seconds:
     - Clear thumbnail of red baby whale
     - Download button for slice file
     - Filament loading instructions: "Load Red PLA (Bambu Lab) into AMS Slot 1"
     - Print settings summary visible at a glance
     - Estimated time: 3h 45min per print

4. **Prepare Printer**
   - Walks to printer, verifies AMS is loaded correctly
   - **Decision Point:** Slot 1 has Blue PLA (wrong color)
   - Swaps filament: removes Blue PLA, loads Red PLA into Slot 1
   - Verifies bed is clean and ready

5. **Download and Start Print**
   - Returns to computer, clicks "Download Slice" button on recipe card
   - File downloads: `baby-whale-red.gcode.3mf` (15MB, ~5 seconds)
   - **Decision Point:** Downloads folder shows new file
   - Opens Bambu Handy app on phone
   - Uploads slice to printer via LAN
   - Starts print from printer touchscreen
   - Print begins successfully

6. **Queue Additional Prints**
   - **Decision Point:** Need 3 total whales, sets up print queue
   - Returns to recipe card, downloads slice again (reference for future prints)
   - Queues remaining 2 prints in Bambu Handy
   - Total time from "need to print" to "first print started": **4 minutes**

**Owner Intervention Required:** Zero questions asked, fully autonomous execution

**Success Metrics:**
- ✓ Found correct product in <30 seconds
- ✓ Identified correct filament/slot configuration without confusion
- ✓ Started print in <5 minutes from request
- ✓ Zero interruptions to owner's product development work

---

### Journey 3: New Variant Addition (Owner)

**Persona:** Taylor (Print Farm Owner)
**Goal:** Add "Blue" variant to existing "Baby Whale" product
**Frequency:** Monthly (expanding popular products)
**Success Criteria:** New variant recipe available without disrupting existing Red variant

**Journey Steps:**

1. **Decide to Add Variant**
   - Owner identifies customer demand for blue whale variant
   - Already has base model files uploaded from Journey 1
   - Needs to create new slice with different filament configuration

2. **Create New Slice Configuration**
   - Opens Bambu Studio slicer
   - Loads existing "Baby Whale" .stl model (downloads from system if needed)
   - **Decision Point:** Uses same settings as Red variant (0.16mm, supports) but changes filament
   - Configures: Blue PLA (slot 2) instead of Red PLA (slot 1)
   - Generates slice → saves as `baby-whale-blue.gcode.3mf`

3. **Upload Slice for Existing Product**
   - Opens PrintFarm Manager
   - Navigates to existing "Baby Whale" product detail page
   - **Decision Point:** Sees existing "Red" variant, wants to add "Blue" alongside it
   - Clicks "Add Slice" button (not tied to specific variant yet)
   - Uploads `baby-whale-blue.gcode.3mf`
   - Metadata extraction runs (5-10 seconds)

4. **Handle Filament Matching**
   - Wizard displays extracted metadata:
     - Filament: Blue PLA, Bambu Lab (AMS Slot 2)
   - **Decision Point:** System searches for matching filament record
   - **Scenario A (Match Found):** Blue PLA record exists → auto-selected in wizard
   - **Scenario B (No Match):** No blue filament record exists
     - Wizard shows "No matching filament found" warning
     - Inline creation form appears
     - Owner enters: Brand="Bambu Lab", Color=#0086D6, Material="PLA", Type="Basic"
     - System creates new filament record with exact metadata match
   - Wizard confirms: "Blue PLA (Bambu Lab) - Slot 2"

5. **Create New Variant**
   - Wizard advances to variant selection
   - **Decision Point:** Owner chooses "Create New Variant" (not replace existing)
   - Enters variant name: "Blue"
   - Sets quantity-per-print: 1 (same as Red)
   - Thumbnail extracted from .gcode.3mf shows blue whale
   - Clicks "Save Variant"
   - System links new slice to new "Blue" variant on existing product

6. **Verify Multi-Variant Product**
   - Product detail page now shows:
     - Product: "Baby Whale"
     - Variant 1: "Red" (Recipe: Red PLA, Slot 1)
     - Variant 2: "Blue" (Recipe: Blue PLA, Slot 2)
   - Each variant has independent recipe card with correct filament configuration
   - Search for "whale" returns single product card with both variants visible

**Key Benefits:**
- Same base model reused across variants (no duplicate uploads)
- Different slice configurations coexist peacefully
- Assistant can independently produce either color without confusion
- Product catalog stays organized (variants grouped under single product)

**Edge Cases Handled:**
- Filament matching fails → inline creation prevents blocking workflow
- Variants can share slices OR have unique slices (flexible many-to-many relationship)
- Thumbnails automatically extracted, fallback to product thumbnail if needed

## UX Design Principles

### 1. Visual-First Navigation

**Principle:** Thumbnails are the primary navigation mechanism, supplemented by clear product names.

**Rationale:** Print farm operators think visually—they recognize products by appearance, not names. Large, high-quality thumbnails enable instant recognition and reduce cognitive load when scanning catalog. Names provide essential context and aid search/filtering.

**Implementation:**
- Grid layout as default view for products, models, and slices
- Minimum thumbnail size: 200x200px in grid, 400x400px in detail views
- Product/model names displayed below or overlaid on thumbnails in grid view
- Hover to enlarge thumbnails for closer inspection
- Text search complements visual browsing, never replaces it

**Success Metric:** Users can identify target product in <10 seconds by visual scanning alone

---

### 2. Zero-Friction Uploads

**Principle:** File uploads should feel instant and require minimal interaction.

**Rationale:** Uploading is a frequent operation that blocks productivity. Every click, every form field, every confirmation adds friction. The system should intelligently extract all possible information and only ask users for missing critical data.

**Implementation:**
- Drag-and-drop anywhere on relevant pages (models page, slice upload)
- Percentage-based progress bars for transparency
- Auto-extract metadata instead of manual entry (filaments, settings, thumbnails)
- Pre-populate forms with extracted data, allow override only when needed
- Bulk operations supported (select multiple files from zip extraction)

**Success Metric:** <3 clicks from file selection to upload completion for typical workflows

---

### 3. Immediate Feedback, Always

**Principle:** Every user action receives instant visual acknowledgment.

**Rationale:** Print farm operations move fast. Users need confidence their actions registered and succeeded. Silence creates uncertainty and repeat actions (did my upload work? let me try again...).

**Implementation:**
- Button states change on click (loading spinner, disabled state)
- Toast notifications for success/error with auto-dismiss (5 seconds)
- Inline validation messages appear immediately (file too large, name already exists)
- Optimistic UI updates where safe (show uploaded file immediately, rollback on error)
- Progress indicators for operations >3 seconds

**Success Metric:** Zero "is this working?" moments during user testing

---

### 4. Errors Are Helpful, Not Punishing

**Principle:** Error messages explain what went wrong AND suggest how to fix it.

**Rationale:** Errors are learning opportunities, not failures. Cryptic technical messages waste time and create dependency on the owner for troubleshooting.

**Implementation:**
- Descriptive language: "File too large: 510MB exceeds 500MB limit" not "Error: File size validation failed"
- Actionable guidance: "Upload failed: Connection interrupted. Please try again." with retry button
- Preserve form data on errors (no re-entry punishment)
- Contextual help inline with error messages ("Need help? Check troubleshooting guide")
- Never show stack traces or error codes to end users

**Success Metric:** Users can self-recover from 90% of errors without external help

---

### 5. Progressive Disclosure of Complexity

**Principle:** Show simple by default, reveal complexity on demand.

**Rationale:** Most users need core functionality 95% of the time. Advanced features and full metadata should be accessible but not overwhelming the primary interface.

**Implementation:**
- Recipe cards show curated settings by default (layer height, temp, filament, time)
- "Show All Metadata" toggle reveals complete JSON extraction
- Model detail pages prioritize slice download and product linking over technical specs
- Advanced filters collapsed by default, expand on click
- Settings/configuration tucked in footer or dedicated page, not navigation clutter

**Success Metric:** First-time assistant can execute print without seeing advanced features

---

### 6. Search That Forgives

**Principle:** Search should work even when users don't remember exact names or make typos.

**Rationale:** Catalog will grow to 1000+ products. Users won't remember precise names. "whle" should find "whale", "bby" should find "baby".

**Implementation:**
- Fuzzy text matching with typo tolerance (Levenshtein distance or third-party search)
- Case-insensitive matching always
- Substring matching ("whale" matches "Baby Whale Figurine")
- Search-as-you-type with debouncing (results appear while typing)
- Search bar always visible and accessible (sticky header or prominent placement)

**Success Metric:** 95% of searches find intended product within first 3 results

---

### 7. Relationships Made Visible

**Principle:** Show connections between entities to enable discovery and prevent orphans.

**Rationale:** Print farm catalog is a network: products link to slices, slices link to models and filaments. Making these relationships visible helps users understand system state and navigate efficiently.

**Implementation:**
- Filament detail pages show "Used in 12 slices" with clickable list
- Model detail pages show "Used in 3 slices" and "Associated products"
- Product cards display variant count and slice status
- Broken relationships flagged with warnings ("Missing filament: Red PLA deleted")
- Breadcrumb navigation shows current location in relationship hierarchy

**Success Metric:** Users can navigate from any entity to related entities in ≤2 clicks

---

### 8. Defaults That Make Sense

**Principle:** Pre-select the most common choice to reduce decision fatigue.

**Rationale:** Many operations have an obvious "right" choice 80% of the time. Users should confirm, not configure from scratch.

**Implementation:**
- Metadata extraction pre-fills wizard forms (user confirms, rarely edits)
- Thumbnail selection defaults to first extracted image (user can override)
- Quantity-per-print defaults to 1 (most common scenario)
- New variants default to same settings as existing variant on product (user tweaks if needed)
- Sort order defaults to "recently added" (most relevant for growing catalog)

**Success Metric:** Users accept default values >80% of the time during wizard flows

---

### 9. Responsive by Design, Desktop-Optimized for Workflows

**Principle:** Build mobile-responsive interfaces from the start, but optimize complex workflows for desktop where they'll actually be used.

**Rationale:** File uploads and catalog management happen at desktop workstations. Recipe card reference and catalog browsing happen at the printer (mobile/tablet). Mobile-first CSS ensures everything works everywhere, but UX optimization prioritizes the device where each workflow actually occurs.

**Implementation:**
- Mobile-first CSS breakpoints ensure responsive layouts from smallest to largest screens
- File upload workflows optimized for desktop (drag-and-drop, multi-file selection, large forms)
- Recipe cards optimized for mobile (large touch targets, readable at printer, easy downloads)
- Search and browsing work seamlessly on both desktop and mobile
- Grid layouts adapt: 4 columns desktop → 2 columns tablet → 1 column mobile
- Touch-friendly by default (React Aria Components, 44px minimum tap targets)

**Success Metric:** Recipe cards fully functional on mobile; upload workflows efficient on desktop; zero broken layouts on any device

---

### 10. Performance Is a Feature

**Principle:** Speed is not negotiable—fast interfaces feel reliable and professional.

**Rationale:** Slow systems create doubt ("did it work? should I try again?") and waste time. Every second of delay compounds across daily operations.

**Implementation:**
- Page loads in ≤2 seconds (lazy load images, code splitting)
- Search results in ≤1 second (indexed queries, third-party search if needed)
- Optimistic UI updates where safe (show upload success immediately, background processing)
- Skeleton loaders during data fetch (visual feedback while loading)
- Image optimization and lazy loading (don't load 50 thumbnails upfront)

**Success Metric:** Zero user complaints about slowness during beta testing

## Epics

### Epic Overview

The PrintFarm Manager MVP is delivered through **5 epics** spanning approximately **30-35 user stories**. Epic sequencing prioritizes infrastructure foundation before feature development to ensure proper development workflow from day one.

**Epic 1: Deployment & Operations Foundation** (Stories: 6-8, Priority: CRITICAL)
- Establishes three environments (dev/staging/production) with automated deployments
- Configures Cloudflare Workers Builds, Xata database branching, R2 buckets
- Implements logging, monitoring, and observability
- Enables development team to work efficiently with proper CI/CD pipeline
- **Rationale:** Without deployment infrastructure, no features can be tested or released

**Epic 2: Core File Management** (Stories: 7-9, Priority: HIGH)
- Implements model and slice file upload workflows with R2 storage
- Builds zip extraction with recursive directory scanning and file selection
- Creates thumbnail handling with auto-resize and fallback logic
- Establishes foundational CRUD operations for models and slices
- **Rationale:** File storage is the foundation for all metadata extraction and product creation

**Epic 3: Metadata Extraction & Filament Matching** (Stories: 6-8, Priority: HIGH)
- Parses Bambu Lab `.gcode.3mf` files and extracts JSON metadata
- Implements smart filament matching algorithm with normalization
- Builds filament management UI with inline creation during wizard
- Handles AMS slot tracking and metadata validation
- **Rationale:** Automation is the core value proposition—eliminates manual data entry

**Epic 4: Product & Recipe System** (Stories: 8-10, Priority: HIGH)
- Creates product and variant entities with many-to-many slice relationships
- Implements wizard workflow from slice upload to product creation
- Generates recipe cards with curated settings and UUID-based URLs
- Builds product detail pages with variant management
- **Rationale:** Recipe cards enable assistant autonomy—the primary business goal

**Epic 5: Search & Discovery** (Stories: 5-7, Priority: MEDIUM)
- Implements fuzzy search with typo tolerance across product/model names
- Builds visual grid browsing with thumbnails and responsive layouts
- Creates relationship navigation (filament → slices, model → products, etc.)
- Adds "needs slicing" tracking and basic filtering
- **Rationale:** Search enables efficient catalog navigation as inventory grows to 1000+ products

### Delivery Strategy

**Phase 1 (Weeks 1-2): Infrastructure & Foundation**
- Epic 1 completed first to establish deployment pipeline
- Allows parallel development with proper staging/production environments
- Team can deploy and test features incrementally

**Phase 2 (Weeks 3-5): Core Workflows**
- Epics 2-3 deliver end-to-end workflow: upload → extract → match
- MVP becomes functionally useful (can upload and process files)
- Validated through owner testing in staging environment

**Phase 3 (Weeks 6-8): Business Value**
- Epic 4 delivers recipe cards—unlocks assistant autonomy
- First real ROI: owner can share recipe URLs with assistant
- Epic 5 improves discoverability as catalog grows

**Success Criteria:**
- Owner can upload model zip, slice in Bambu Studio, upload slice, create product with recipe card
- Assistant can search for product, access recipe card, download slice, and start print independently
- Zero questions from assistant about filament/settings (information on recipe card)
- All operations traceable through logs in Cloudflare Dashboard

**Out of Scope for MVP (Deferred to Phase 2/3):**
- Authentication and multi-user access control
- Soft delete with 30-day grace period and restore
- Data export (JSON/CSV)
- Advanced search (variant names, filenames, filament brands)
- Dashboard widgets (recent products, quick actions)
- Inventory tracking and quantity management
- Batch file downloads
- Mobile upload optimization
- Version history for slices
- Notes/instructions on "needs slicing" items

See `epics.md` for detailed story breakdown with acceptance criteria.

## Out of Scope

The following features are intentionally excluded from MVP to maintain focus on core value delivery. These items are preserved for future phases based on validated usage patterns and business needs.

### Deferred to Phase 2 (Post-MVP Enhancements)

**Authentication & Access Control**
- User login and authentication system
- Role-based permissions (owner vs assistant access levels)
- Multi-user session management
- Note: MVP is publicly accessible; authentication required before any external users

**Data Management & Recovery**
- Soft delete with 30-day grace period
- Trash/recycle bin UI for deleted items
- Restore functionality for accidentally deleted records
- Data export capabilities (JSON, CSV formats)
- Bulk operations (batch delete, batch download)

**Advanced Search & Filtering**
- Search expansion beyond product/model names (variants, filenames, filament brands)
- Advanced filter combinations (material + color + print time range)
- Saved searches and search history
- Tag-based organization system

**UI/UX Enhancements**
- Dashboard with widgets (recent products, quick stats, needs slicing summary)
- Mobile upload optimization (camera integration, mobile-specific workflows)
- Pagination for product lists (defer until catalog exceeds 50 items)
- List view alternative to grid view
- Bulk thumbnail upload/replacement

**Workflow Improvements**
- Notes/instructions field on "needs slicing" items
- Archive/dismiss functionality for "needs slicing" list
- Slice version history (track multiple versions per model)
- Color-only filament override (change color without reslicing)
- Print templates (save common slicer configurations)

**Monitoring & Analytics**
- Usage analytics dashboard (upload frequency, popular products, search patterns)
- Storage quota warnings (alert at 80% of free tier limit)
- Automated backup verification testing
- Performance metrics visualization

### Deferred to Phase 3 (SaaS Transformation Investigation)

**Multi-Tenancy**
- Multi-tenant architecture activation (tenant_id enforcement)
- Tenant-specific data isolation and security
- Subscription management and billing
- User registration and onboarding flows
- Tenant-level configuration and branding

**Inventory & Production Management**
- Physical inventory tracking (quantity on hand)
- Production run logging (track what was printed when)
- Low inventory alerts and reorder triggers
- Customer order management
- Shipping and fulfillment integration

**Collaboration Features**
- Comments and notes on products/slices
- Activity feed showing recent changes
- Notifications for assistants (new recipes, updates)
- Shared workspaces for multiple print farms

**Integration & Extensibility**
- API for third-party integrations
- Webhook support for automation
- Direct Bambu Lab printer integration (upload slices directly to printers)
- E-commerce platform integration (Etsy, Shopify)

**Market Validation Required**
- Before committing to Phase 3 SaaS features, conduct user research:
  - Interview 10+ small print farm operators
  - Validate willingness to pay and pricing model
  - Identify must-have vs nice-to-have features for multi-user SaaS
  - Assess competitive landscape and differentiation opportunities

---

## Next Steps

### Phase 1: Architecture and Design (IMMEDIATE)

**Primary Action: Run Architecture Workflow**

Since this is a Level 3 project, you need solution architecture before story implementation. Start a new session with the architect persona and provide:

1. **This PRD:** `/home/taylor/projects/printfarm-manager/docs/PRD.md`
2. **Epic Structure:** `/home/taylor/projects/printfarm-manager/docs/epics.md`
3. **Product Brief:** `/home/taylor/projects/printfarm-manager/docs/product-brief-printfarm-manager-2025-10-08.md`
4. **Metadata Example:** `/home/taylor/projects/printfarm-manager/docs/bambu-lab-metadata-example.json`

**Ask architect to:**
- Design solution architecture for TanStack Start + Cloudflare Workers + Xata + R2
- Define database schema (tables, relationships, indexes) based on Epic 2 Story 2.1 requirements
- Create API endpoint specifications for all file operations
- Design metadata extraction pipeline architecture
- Document deployment and environment strategy
- Generate `docs/architecture.md`

**UX Specification (HIGHLY RECOMMENDED)**

This is a user-facing system with complex UI workflows. After architecture is complete, run UX specification workflow:

- Command: Run BMM UX workflow or continue within architecture session
- Input: PRD.md, epics.md, architecture.md
- Output: `docs/ux-specification.md`
- Includes: Information architecture, user flows, component library, wireframes/mockups

### Phase 2: Development Preparation

**Complete Before Sprint 1:**

- [ ] **Database Schema Implementation**
  - Create Prisma schema file
  - Run migrations in dev environment
  - Validate schema against all FR requirements
  - Document ER diagram

- [ ] **Environment Setup Verification**
  - Confirm all three environments operational (dev/staging/production)
  - Test Cloudflare Workers Builds deployment pipeline
  - Verify Xata branching works for PR previews
  - Validate R2 buckets accessible from all environments

- [ ] **Technical Spikes (if needed)**
  - Spike: Xata database branching integration with Cloudflare builds
  - Spike: R2 file header configuration for forced downloads
  - Spike: Fuzzy search options (Xata full-text vs Levenshtein)
  - Spike: Image resizing library selection (sharp vs canvas)
  - Spike: Zip extraction performance with 500MB files

- [ ] **Development Standards**
  - Configure ESLint/Prettier (already in place per CLAUDE.md)
  - Set up testing framework (Vitest configured)
  - Define commit message conventions
  - Establish PR review checklist

### Phase 3: Sprint Planning

**Sprint Structure: 2-Week Sprints**

**Sprint 0 (Pre-Development):** Epic 1 - Deployment & Operations Foundation
- Complete environment setup before feature development
- Validate CI/CD pipeline working end-to-end
- Ensure logging and monitoring operational

**Sprint 1:** Epic 2 - Core File Management (Stories 2.1-2.4)
- Database schema
- Model upload API and UI
- Zip extraction and file selection

**Sprint 2:** Epic 2 - Core File Management (Stories 2.5-2.8)
- Slice upload API
- Thumbnail handling
- Model and slice CRUD operations

**Sprint 3:** Epic 3 - Metadata Extraction (Stories 3.1-3.4)
- .gcode.3mf parsing
- Metadata validation with Zod
- Filament matching algorithm
- Filament management UI

**Sprint 4:** Epic 3 - Metadata Extraction (Stories 3.5-3.7) + Epic 4 Start
- Inline filament creation
- Curated metadata display
- Metadata-driven wizard
- Product entity CRUD (Story 4.1)

**Sprint 5:** Epic 4 - Product & Recipe System (Stories 4.2-4.5)
- Product variants
- Slice-variant linking
- Multi-model slice support
- Recipe card generation

**Sprint 6:** Epic 4 - Product & Recipe System (Stories 4.6-4.8) + Epic 5 Start
- Product creation wizard
- Needs slicing tracking
- Relationship navigation
- Basic search infrastructure (Story 5.1)

**Sprint 7:** Epic 5 - Search & Discovery (Stories 5.2-5.6)
- Fuzzy search
- Visual grid browsing
- Landing page
- Filtering
- File downloads

**Sprint 8:** Buffer and Polish
- Bug fixes from previous sprints
- Performance optimization
- UX refinements
- Documentation completion

### Phase 4: Testing and Launch

- [ ] **User Acceptance Testing**
  - Owner completes full workflow: upload → slice → create product → generate recipe
  - Assistant tests recipe card workflow: search → find → download → print
  - Validate all success criteria from epic goals

- [ ] **Performance Validation**
  - Load test with 1000+ products
  - Verify search performance <1 second
  - Test 500MB zip file upload
  - Validate recipe card mobile experience

- [ ] **Deployment to Staging**
  - Deploy complete MVP to staging environment
  - Run smoke tests on all major workflows
  - Validate logging and monitoring working

- [ ] **Production Launch**
  - Deploy to production environment
  - Share recipe URLs with assistant
  - Monitor logs for first week
  - Collect feedback for Phase 2 planning

### Phase 5: Post-Launch (3-6 Months)

- [ ] **Usage Validation**
  - Track operational metrics: reslicing reduction, assistant questions, search usage
  - Validate business goals achieved (95% reduction in reslicing, assistant autonomy)
  - Document learnings and pain points

- [ ] **Market Research (if SaaS investigation desired)**
  - Interview 10+ small print farm operators
  - Validate willingness to pay
  - Assess competitive landscape
  - Decision: proceed with Phase 3 SaaS transformation or stay personal tool

- [ ] **Phase 2 Planning**
  - Review "Out of Scope" deferred features
  - Prioritize based on validated usage patterns
  - Create Phase 2 PRD and roadmap

## Document Status

- [x] Goals and context validated with stakeholders
- [x] All functional requirements reviewed (18 FRs organized by user journey)
- [x] Non-functional requirements defined (12 NFRs)
- [x] User journeys cover all major personas (3 detailed journeys)
- [x] UX design principles established (10 principles)
- [x] Epic structure approved for phased delivery (5 epics, 32 stories)
- [x] Out of scope items documented for Phase 2/3
- [ ] **NEXT:** Architecture phase - run architecture workflow with this PRD

**Document Completeness:** ✅ PRD Complete and Ready for Handoff

**Total Pages:** ~350 lines (PRD) + ~1000 lines (epics.md)
**Estimated Implementation:** 6-8 weeks (8 sprints)
**Target Deployment:** Staging (pm-staging.solsystemlabs.com), Production (pm.solsystemlabs.com)

_Note: Technical decisions and clarifications captured throughout elicitation rounds are embedded in requirements and epic stories_

---

_This PRD was created following Level 3 standards - comprehensive requirements with architect handoff,适合 12-40 story projects with 2-5 epics._

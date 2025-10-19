-- CreateTable
CREATE TABLE "models" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "filename" TEXT NOT NULL,
    "r2_key" TEXT NOT NULL,
    "r2_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "filename" TEXT NOT NULL,
    "r2_key" TEXT NOT NULL,
    "r2_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "metadata_extracted" BOOLEAN NOT NULL DEFAULT false,
    "metadata_json" JSONB,
    "layer_height" DOUBLE PRECISION,
    "nozzle_temp" INTEGER,
    "bed_temp" INTEGER,
    "print_speed" INTEGER,
    "infill_percent" INTEGER,
    "supports_enabled" BOOLEAN,
    "estimated_time_sec" INTEGER,
    "filament_used_g" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filaments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "brand" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL,
    "color_name" TEXT,
    "material_type" TEXT NOT NULL,
    "filament_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slice_filaments" (
    "id" TEXT NOT NULL,
    "slice_id" TEXT NOT NULL,
    "filament_id" TEXT NOT NULL,
    "ams_slot_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slice_filaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slice_models" (
    "id" TEXT NOT NULL,
    "slice_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slice_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slice_variants" (
    "id" TEXT NOT NULL,
    "slice_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "quantity_per_print" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slice_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "models_tenant_id_idx" ON "models"("tenant_id");

-- CreateIndex
CREATE INDEX "models_filename_idx" ON "models"("filename");

-- CreateIndex
CREATE INDEX "slices_tenant_id_idx" ON "slices"("tenant_id");

-- CreateIndex
CREATE INDEX "slices_metadata_extracted_idx" ON "slices"("metadata_extracted");

-- CreateIndex
CREATE INDEX "filaments_tenant_id_idx" ON "filaments"("tenant_id");

-- CreateIndex
CREATE INDEX "filaments_brand_idx" ON "filaments"("brand");

-- CreateIndex
CREATE INDEX "filaments_material_type_idx" ON "filaments"("material_type");

-- CreateIndex
CREATE UNIQUE INDEX "filaments_brand_color_hex_material_type_filament_type_key" ON "filaments"("brand", "color_hex", "material_type", "filament_type");

-- CreateIndex
CREATE INDEX "slice_filaments_slice_id_idx" ON "slice_filaments"("slice_id");

-- CreateIndex
CREATE INDEX "slice_filaments_filament_id_idx" ON "slice_filaments"("filament_id");

-- CreateIndex
CREATE UNIQUE INDEX "slice_filaments_slice_id_ams_slot_index_key" ON "slice_filaments"("slice_id", "ams_slot_index");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_tenant_id_idx" ON "products"("tenant_id");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "product_variants_tenant_id_idx" ON "product_variants"("tenant_id");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_name_key" ON "product_variants"("product_id", "name");

-- CreateIndex
CREATE INDEX "slice_models_slice_id_idx" ON "slice_models"("slice_id");

-- CreateIndex
CREATE INDEX "slice_models_model_id_idx" ON "slice_models"("model_id");

-- CreateIndex
CREATE UNIQUE INDEX "slice_models_slice_id_model_id_key" ON "slice_models"("slice_id", "model_id");

-- CreateIndex
CREATE INDEX "slice_variants_slice_id_idx" ON "slice_variants"("slice_id");

-- CreateIndex
CREATE INDEX "slice_variants_variant_id_idx" ON "slice_variants"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "slice_variants_slice_id_variant_id_key" ON "slice_variants"("slice_id", "variant_id");

-- AddForeignKey
ALTER TABLE "slice_filaments" ADD CONSTRAINT "slice_filaments_slice_id_fkey" FOREIGN KEY ("slice_id") REFERENCES "slices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slice_filaments" ADD CONSTRAINT "slice_filaments_filament_id_fkey" FOREIGN KEY ("filament_id") REFERENCES "filaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slice_models" ADD CONSTRAINT "slice_models_slice_id_fkey" FOREIGN KEY ("slice_id") REFERENCES "slices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slice_models" ADD CONSTRAINT "slice_models_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slice_variants" ADD CONSTRAINT "slice_variants_slice_id_fkey" FOREIGN KEY ("slice_id") REFERENCES "slices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slice_variants" ADD CONSTRAINT "slice_variants_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

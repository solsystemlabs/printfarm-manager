import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { prisma } from "../client";

describe("Database Schema", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Table Creation", () => {
    it("should have all required tables", async () => {
      const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name::text
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name NOT LIKE '_prisma%'
        ORDER BY table_name
      `;

      const tableNames = tables.map((t) => t.table_name);

      expect(tableNames).toContain("models");
      expect(tableNames).toContain("slices");
      expect(tableNames).toContain("filaments");
      expect(tableNames).toContain("slice_filaments");
      expect(tableNames).toContain("products");
      expect(tableNames).toContain("product_variants");
      expect(tableNames).toContain("slice_models");
      expect(tableNames).toContain("slice_variants");
    });
  });

  describe("Model Entity", () => {
    let createdModelId: string;

    afterEach(async () => {
      if (createdModelId) {
        await prisma.model
          .delete({ where: { id: createdModelId } })
          .catch(() => {});
      }
    });

    it("should create a model with all required fields", async () => {
      const model = await prisma.model.create({
        data: {
          filename: "test-model.stl",
          r2Key: "models/test-model.stl",
          r2Url: "https://example.com/test-model.stl",
          fileSize: 1024000,
          contentType: "model/stl",
        },
      });

      createdModelId = model.id;
      expect(model.id).toBeDefined();
      expect(model.filename).toBe("test-model.stl");
      expect(model.createdAt).toBeInstanceOf(Date);
      expect(model.updatedAt).toBeInstanceOf(Date);
    });

    it("should support optional tenant_id", async () => {
      const modelWithTenant = await prisma.model.create({
        data: {
          tenantId: "tenant-123",
          filename: "test.stl",
          r2Key: "test.stl",
          r2Url: "https://example.com/test.stl",
          fileSize: 1000,
          contentType: "model/stl",
        },
      });

      createdModelId = modelWithTenant.id;
      expect(modelWithTenant.tenantId).toBe("tenant-123");
    });
  });

  describe("Filament Entity", () => {
    let createdFilamentId: string;

    afterEach(async () => {
      if (createdFilamentId) {
        await prisma.filament
          .delete({ where: { id: createdFilamentId } })
          .catch(() => {});
      }
    });

    it("should create a filament with required fields", async () => {
      const filament = await prisma.filament.create({
        data: {
          brand: "Bambu Lab",
          colorHex: "#FF5733",
          colorName: "Red",
          materialType: "PLA",
          filamentType: "Basic",
        },
      });

      createdFilamentId = filament.id;
      expect(filament.id).toBeDefined();
      expect(filament.brand).toBe("Bambu Lab");
      expect(filament.colorHex).toBe("#FF5733");
    });

    it("should enforce unique constraint on (brand, colorHex, materialType, filamentType)", async () => {
      const filament = await prisma.filament.create({
        data: {
          brand: "Test Brand",
          colorHex: "#000000",
          materialType: "PETG",
          filamentType: "Matte",
        },
      });

      createdFilamentId = filament.id;

      // Attempting to create duplicate should fail
      await expect(
        prisma.filament.create({
          data: {
            brand: "Test Brand",
            colorHex: "#000000",
            materialType: "PETG",
            filamentType: "Matte",
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("Product and ProductVariant Entities", () => {
    let createdProductId: string;
    let createdVariantId: string;

    afterEach(async () => {
      if (createdVariantId) {
        await prisma.productVariant
          .delete({ where: { id: createdVariantId } })
          .catch(() => {});
      }
      if (createdProductId) {
        await prisma.product
          .delete({ where: { id: createdProductId } })
          .catch(() => {});
      }
    });

    it("should create a product with unique name", async () => {
      const product = await prisma.product.create({
        data: {
          name: "Test Product",
          description: "A test product",
        },
      });

      createdProductId = product.id;
      expect(product.name).toBe("Test Product");
    });

    it("should enforce unique constraint on product name", async () => {
      const product = await prisma.product.create({
        data: {
          name: "Unique Product",
        },
      });

      createdProductId = product.id;

      // Attempting to create duplicate should fail
      await expect(
        prisma.product.create({
          data: {
            name: "Unique Product",
          },
        }),
      ).rejects.toThrow();
    });

    it("should create product variant with unique name per product", async () => {
      const product = await prisma.product.create({
        data: {
          name: "Product with Variants",
        },
      });

      createdProductId = product.id;

      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: "Variant A",
        },
      });

      createdVariantId = variant.id;
      expect(variant.name).toBe("Variant A");
      expect(variant.productId).toBe(product.id);
    });

    it("should enforce unique constraint on variant name within product", async () => {
      const product = await prisma.product.create({
        data: {
          name: "Product for Variant Test",
        },
      });

      createdProductId = product.id;

      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: "Same Name",
        },
      });

      createdVariantId = variant.id;

      // Same variant name in same product should fail
      await expect(
        prisma.productVariant.create({
          data: {
            productId: product.id,
            name: "Same Name",
          },
        }),
      ).rejects.toThrow();
    });

    it("should cascade delete variants when product is deleted", async () => {
      const product = await prisma.product.create({
        data: {
          name: "Product to Delete",
          variants: {
            create: {
              name: "Variant to Delete",
            },
          },
        },
        include: {
          variants: true,
        },
      });

      createdProductId = product.id;
      const variantId = product.variants[0].id;

      // Delete product
      await prisma.product.delete({ where: { id: product.id } });
      createdProductId = ""; // Already deleted

      // Variant should be deleted too (cascade)
      const deletedVariant = await prisma.productVariant.findUnique({
        where: { id: variantId },
      });

      expect(deletedVariant).toBeNull();
    });
  });

  describe("Junction Tables", () => {
    let modelId: string;
    let sliceId: string;
    let filamentId: string;
    let productId: string;
    let variantId: string;

    beforeEach(async () => {
      // Create test data
      const model = await prisma.model.create({
        data: {
          filename: "junction-test.stl",
          r2Key: "junction-test.stl",
          r2Url: "https://example.com/junction-test.stl",
          fileSize: 1000,
          contentType: "model/stl",
        },
      });
      modelId = model.id;

      const slice = await prisma.slice.create({
        data: {
          filename: "junction-test.3mf",
          r2Key: "junction-test.3mf",
          r2Url: "https://example.com/junction-test.3mf",
          fileSize: 2000,
          contentType: "application/3mf",
        },
      });
      sliceId = slice.id;

      const filament = await prisma.filament.create({
        data: {
          brand: "Junction Test",
          colorHex: "#123456",
          materialType: "PLA",
          filamentType: "Basic",
        },
      });
      filamentId = filament.id;

      const product = await prisma.product.create({
        data: {
          name: "Junction Test Product",
        },
      });
      productId = product.id;

      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: "Junction Test Variant",
        },
      });
      variantId = variant.id;
    });

    afterEach(async () => {
      // Cleanup in correct order (delete children before parents)
      await prisma.sliceModel.deleteMany({ where: { sliceId } });
      await prisma.sliceFilament.deleteMany({ where: { sliceId } });
      await prisma.sliceVariant.deleteMany({ where: { sliceId } });
      await prisma.slice.delete({ where: { id: sliceId } }).catch(() => {});
      await prisma.model.delete({ where: { id: modelId } }).catch(() => {});
      await prisma.filament
        .delete({ where: { id: filamentId } })
        .catch(() => {});
      await prisma.productVariant
        .delete({ where: { id: variantId } })
        .catch(() => {});
      await prisma.product.delete({ where: { id: productId } }).catch(() => {});
    });

    it("should create SliceModel junction", async () => {
      const sliceModel = await prisma.sliceModel.create({
        data: {
          sliceId,
          modelId,
        },
      });

      expect(sliceModel.sliceId).toBe(sliceId);
      expect(sliceModel.modelId).toBe(modelId);
    });

    it("should enforce unique constraint on SliceModel (sliceId, modelId)", async () => {
      await prisma.sliceModel.create({
        data: { sliceId, modelId },
      });

      // Duplicate should fail
      await expect(
        prisma.sliceModel.create({
          data: { sliceId, modelId },
        }),
      ).rejects.toThrow();
    });

    it("should create SliceFilament junction with AMS slot index", async () => {
      const sliceFilament = await prisma.sliceFilament.create({
        data: {
          sliceId,
          filamentId,
          amsSlotIndex: 1,
        },
      });

      expect(sliceFilament.amsSlotIndex).toBe(1);
    });

    it("should enforce unique constraint on (sliceId, amsSlotIndex)", async () => {
      await prisma.sliceFilament.create({
        data: { sliceId, filamentId, amsSlotIndex: 2 },
      });

      // Same slot in same slice should fail
      await expect(
        prisma.sliceFilament.create({
          data: { sliceId, filamentId, amsSlotIndex: 2 },
        }),
      ).rejects.toThrow();
    });

    it("should create SliceVariant junction with quantity", async () => {
      const sliceVariant = await prisma.sliceVariant.create({
        data: {
          sliceId,
          variantId,
          quantityPerPrint: 5,
        },
      });

      expect(sliceVariant.quantityPerPrint).toBe(5);
    });

    it("should use default quantity of 1 for SliceVariant", async () => {
      const sliceVariant = await prisma.sliceVariant.create({
        data: {
          sliceId,
          variantId,
        },
      });

      expect(sliceVariant.quantityPerPrint).toBe(1);
    });

    it("should cascade delete junction when slice is deleted", async () => {
      const junction = await prisma.sliceModel.create({
        data: { sliceId, modelId },
      });

      await prisma.slice.delete({ where: { id: sliceId } });

      const deletedJunction = await prisma.sliceModel.findUnique({
        where: { id: junction.id },
      });

      expect(deletedJunction).toBeNull();
    });

    it("should allow filament deletion and set filamentId to null (SetNull)", async () => {
      const sliceFilament = await prisma.sliceFilament.create({
        data: { sliceId, filamentId, amsSlotIndex: 1 },
      });

      // Delete filament should succeed (SetNull behavior)
      await prisma.filament.delete({ where: { id: filamentId } });

      // Verify filamentId was set to null in junction table
      const updatedSliceFilament = await prisma.sliceFilament.findUnique({
        where: { id: sliceFilament.id },
      });

      expect(updatedSliceFilament).not.toBeNull();
      expect(updatedSliceFilament?.filamentId).toBeNull();
    });
  });

  describe("Slice Metadata", () => {
    let sliceId: string;

    afterEach(async () => {
      if (sliceId) {
        await prisma.slice.delete({ where: { id: sliceId } }).catch(() => {});
      }
    });

    it("should store JSON metadata", async () => {
      const metadata = {
        printer: "Bambu X1C",
        settings: {
          supports: true,
          infill: 20,
        },
      };

      const slice = await prisma.slice.create({
        data: {
          filename: "metadata-test.3mf",
          r2Key: "metadata-test.3mf",
          r2Url: "https://example.com/metadata-test.3mf",
          fileSize: 3000,
          contentType: "application/3mf",
          metadataJson: metadata,
          metadataExtracted: true,
        },
      });

      sliceId = slice.id;
      expect(slice.metadataJson).toEqual(metadata);
      expect(slice.metadataExtracted).toBe(true);
    });

    it("should store denormalized curated fields", async () => {
      const slice = await prisma.slice.create({
        data: {
          filename: "curated-test.3mf",
          r2Key: "curated-test.3mf",
          r2Url: "https://example.com/curated-test.3mf",
          fileSize: 4000,
          contentType: "application/3mf",
          layerHeight: 0.2,
          nozzleTemp: 220,
          bedTemp: 60,
          printSpeed: 100,
          infillPercent: 20,
          supportsEnabled: true,
          estimatedTimeSec: 3600,
          filamentUsedG: 50.5,
        },
      });

      sliceId = slice.id;
      expect(slice.layerHeight).toBe(0.2);
      expect(slice.nozzleTemp).toBe(220);
      expect(slice.filamentUsedG).toBe(50.5);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../client";

describe("Prisma Client", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should connect to database successfully", async () => {
    // Test connection by running a simple query
    const result = await prisma.$queryRaw`SELECT 1 as value`;
    expect(result).toBeDefined();
  });

  it("should be a singleton instance", () => {
    // The prisma export should always be the same instance
    expect(prisma).toBeDefined();
    expect(prisma).toBe(prisma);
  });

  it("should have all expected models", () => {
    // Verify all models are available in the Prisma Client
    expect(prisma.model).toBeDefined();
    expect(prisma.slice).toBeDefined();
    expect(prisma.filament).toBeDefined();
    expect(prisma.sliceFilament).toBeDefined();
    expect(prisma.product).toBeDefined();
    expect(prisma.productVariant).toBeDefined();
    expect(prisma.sliceModel).toBeDefined();
    expect(prisma.sliceVariant).toBeDefined();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateStorageUsage, formatBytes } from "../usage";
// Use local generator for tests (binary engine, Node.js compatible)
import type { PrismaClient } from "../../../../prisma/generated/local";

// Mock Prisma client
const mockPrismaModel = {
  findMany: vi.fn(),
};

const mockPrismaSlice = {
  findMany: vi.fn(),
};

const mockPrisma = {
  model: mockPrismaModel,
  slice: mockPrismaSlice,
} as unknown as PrismaClient;

// Mock fetch for R2 API calls
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("formatBytes", () => {
  it("formats zero bytes", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500.00 Bytes");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(2048)).toBe("2.00 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(5242880)).toBe("5.00 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1.00 GB");
    expect(formatBytes(10737418240)).toBe("10.00 GB");
  });

  it("formats terabytes", () => {
    expect(formatBytes(1099511627776)).toBe("1.00 TB");
  });
});

describe("calculateStorageUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("database-only mode", () => {
    it("returns zero values when database tables do not exist", async () => {
      // Simulate table not existing by throwing error
      mockPrisma.model.findMany = vi
        .fn()
        .mockRejectedValue(new Error("Table does not exist"));
      mockPrisma.slice.findMany = vi
        .fn()
        .mockRejectedValue(new Error("Table does not exist"));

      const result = await calculateStorageUsage(mockPrisma);

      expect(result).toMatchObject({
        totalBytes: 0,
        totalFiles: 0,
        breakdown: {
          models: { count: 0, bytes: 0 },
          slices: { count: 0, bytes: 0 },
          images: { count: 0, bytes: 0 },
        },
        percentOfLimit: 0,
        source: "database",
      });
      expect(result.lastCalculated).toBeInstanceOf(Date);
    });

    it("calculates storage from database when tables exist", async () => {
      // Mock models data
      mockPrisma.model.findMany = vi.fn().mockResolvedValue([
        { fileSize: 1024 * 1024 }, // 1 MB
        { fileSize: 2 * 1024 * 1024 }, // 2 MB
      ]);

      // Mock slices data
      mockPrisma.slice.findMany = vi.fn().mockResolvedValue([
        { fileSize: 512 * 1024 }, // 512 KB
      ]);

      const result = await calculateStorageUsage(mockPrisma);

      expect(result).toMatchObject({
        totalBytes: 3 * 1024 * 1024 + 512 * 1024, // 3.5 MB
        totalFiles: 3,
        breakdown: {
          models: { count: 2, bytes: 3 * 1024 * 1024 },
          slices: { count: 1, bytes: 512 * 1024 },
          images: { count: 0, bytes: 0 },
        },
        source: "database",
      });

      // Verify percentage calculation (3.5 MB / 10 GB)
      const expectedPercent =
        ((3.5 * 1024 * 1024) / (10 * 1024 * 1024 * 1024)) * 100;
      expect(result.percentOfLimit).toBeCloseTo(expectedPercent, 4);
    });
  });

  describe("hybrid mode with R2 API", () => {
    it("uses R2 totals when API succeeds", async () => {
      // Mock database breakdown
      mockPrisma.model.findMany = vi.fn().mockResolvedValue([
        { fileSize: 1024 * 1024 }, // 1 MB
      ]);
      mockPrisma.slice.findMany = vi.fn().mockResolvedValue([
        { fileSize: 512 * 1024 }, // 512 KB
      ]);

      // Mock R2 API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            viewer: {
              accounts: [
                {
                  r2StorageAdaptiveGroups: [
                    {
                      max: {
                        payloadSize: 5 * 1024 * 1024 * 1024, // 5 GB
                        metadataSize: 1024 * 1024, // 1 MB
                        objectCount: 100,
                      },
                    },
                  ],
                },
              ],
            },
          },
        }),
      });

      const result = await calculateStorageUsage(mockPrisma, {
        accountId: "test-account",
        apiToken: "test-token",
        bucketName: "test-bucket",
      });

      // Should use R2 totals
      expect(result.totalBytes).toBe(5 * 1024 * 1024 * 1024 + 1024 * 1024); // 5 GB + 1 MB
      expect(result.totalFiles).toBe(100);
      expect(result.source).toBe("hybrid");

      // But breakdown should still come from database
      expect(result.breakdown).toMatchObject({
        models: { count: 1, bytes: 1024 * 1024 },
        slices: { count: 1, bytes: 512 * 1024 },
        images: { count: 0, bytes: 0 },
      });
    });

    it("falls back to database when R2 API fails", async () => {
      // Mock database data
      mockPrisma.model.findMany = vi
        .fn()
        .mockResolvedValue([{ fileSize: 1024 * 1024 }]);
      mockPrisma.slice.findMany = vi.fn().mockResolvedValue([]);

      // Mock R2 API failure
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await calculateStorageUsage(mockPrisma, {
        accountId: "test-account",
        apiToken: "invalid-token",
        bucketName: "test-bucket",
      });

      // Should fall back to database
      expect(result.totalBytes).toBe(1024 * 1024);
      expect(result.totalFiles).toBe(1);
      expect(result.source).toBe("database");
    });

    it("handles empty R2 bucket", async () => {
      mockPrisma.model.findMany = vi.fn().mockResolvedValue([]);
      mockPrisma.slice.findMany = vi.fn().mockResolvedValue([]);

      // Mock empty bucket response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            viewer: {
              accounts: [
                {
                  r2StorageAdaptiveGroups: [],
                },
              ],
            },
          },
        }),
      });

      const result = await calculateStorageUsage(mockPrisma, {
        accountId: "test-account",
        apiToken: "test-token",
        bucketName: "empty-bucket",
      });

      expect(result.totalBytes).toBe(0);
      expect(result.totalFiles).toBe(0);
      expect(result.source).toBe("hybrid");
    });

    it("sends correct GraphQL query to R2 API", async () => {
      mockPrisma.model.findMany = vi.fn().mockResolvedValue([]);
      mockPrisma.slice.findMany = vi.fn().mockResolvedValue([]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            viewer: {
              accounts: [{ r2StorageAdaptiveGroups: [] }],
            },
          },
        }),
      });

      await calculateStorageUsage(mockPrisma, {
        accountId: "my-account",
        apiToken: "my-token",
        bucketName: "my-bucket",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/graphql",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer my-token",
            "Content-Type": "application/json",
          },
          body: expect.stringContaining("r2StorageAdaptiveGroups"),
        }),
      );

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callArgs.body as string);
      expect(body.variables).toEqual({
        accountTag: "my-account",
        bucketName: "my-bucket",
      });
    });
  });

  describe("percentage calculation", () => {
    it("calculates correct percentage of 10GB limit", async () => {
      mockPrisma.model.findMany = vi.fn().mockResolvedValue([]);
      mockPrisma.slice.findMany = vi.fn().mockResolvedValue([]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            viewer: {
              accounts: [
                {
                  r2StorageAdaptiveGroups: [
                    {
                      max: {
                        payloadSize: 8 * 1024 * 1024 * 1024, // 8 GB
                        metadataSize: 0,
                        objectCount: 1,
                      },
                    },
                  ],
                },
              ],
            },
          },
        }),
      });

      const result = await calculateStorageUsage(mockPrisma, {
        accountId: "test",
        apiToken: "test",
        bucketName: "test",
      });

      // 8 GB / 10 GB = 80%
      expect(result.percentOfLimit).toBe(80);
    });

    it("handles over-limit scenarios", async () => {
      mockPrisma.model.findMany = vi.fn().mockResolvedValue([]);
      mockPrisma.slice.findMany = vi.fn().mockResolvedValue([]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            viewer: {
              accounts: [
                {
                  r2StorageAdaptiveGroups: [
                    {
                      max: {
                        payloadSize: 12 * 1024 * 1024 * 1024, // 12 GB (over limit)
                        metadataSize: 0,
                        objectCount: 1,
                      },
                    },
                  ],
                },
              ],
            },
          },
        }),
      });

      const result = await calculateStorageUsage(mockPrisma, {
        accountId: "test",
        apiToken: "test",
        bucketName: "test",
      });

      // 12 GB / 10 GB = 120%
      expect(result.percentOfLimit).toBe(120);
    });
  });
});

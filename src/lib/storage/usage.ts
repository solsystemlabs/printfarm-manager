import { PrismaClient } from "../../../prisma/generated/client";

/**
 * Storage usage breakdown by file type
 */
export interface StorageUsage {
  totalBytes: number;
  totalFiles: number;
  breakdown: {
    models: { count: number; bytes: number };
    slices: { count: number; bytes: number };
    images: { count: number; bytes: number };
  };
  percentOfLimit: number;
  lastCalculated: Date;
  source: "r2" | "database" | "hybrid";
}

/**
 * Cloudflare account configuration for R2 API access
 */
export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  bucketName: string;
}

/**
 * Cloudflare GraphQL Analytics API response type for r2StorageAdaptiveGroups query
 * @see https://developers.cloudflare.com/r2/platform/metrics-analytics/
 */
export interface R2StorageMetricsResponse {
  data?: {
    viewer?: {
      accounts?: Array<{
        r2StorageAdaptiveGroups?: Array<{
          max?: {
            payloadSize?: number;
            metadataSize?: number;
            objectCount?: number;
          };
        }>;
      }>;
    };
  };
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
}

// Cloudflare R2 free tier limit: 10GB (configurable via R2_STORAGE_LIMIT_BYTES env var)
const FREE_TIER_LIMIT_BYTES =
  Number(process.env.R2_STORAGE_LIMIT_BYTES) || 10 * 1024 * 1024 * 1024;

/**
 * Query R2 storage metrics via Cloudflare GraphQL Analytics API
 *
 * @param config - Cloudflare account configuration
 * @returns Total bytes and object count from R2
 *
 * @remarks
 * Uses the r2StorageAdaptiveGroups dataset to get authoritative storage metrics.
 * This matches what Cloudflare uses for billing.
 *
 * @see https://developers.cloudflare.com/r2/platform/metrics-analytics/
 */
async function queryR2StorageMetrics(
  config: CloudflareConfig,
): Promise<{ totalBytes: number; totalFiles: number } | null> {
  try {
    const query = `
      query GetR2Metrics($accountTag: String!, $bucketName: String!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            r2StorageAdaptiveGroups(
              limit: 1
              filter: { bucketName: $bucketName }
              orderBy: [date_DESC]
            ) {
              max {
                payloadSize
                metadataSize
                objectCount
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: {
            accountTag: config.accountId,
            bucketName: config.bucketName,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "R2 GraphQL API error:",
        response.status,
        response.statusText,
      );
      return null;
    }

    const result = (await response.json()) as R2StorageMetricsResponse;
    const storageData =
      result?.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups?.[0];

    if (!storageData) {
      // No data returned (bucket might be empty or newly created)
      return { totalBytes: 0, totalFiles: 0 };
    }

    const payloadSize = storageData.max?.payloadSize || 0;
    const metadataSize = storageData.max?.metadataSize || 0;
    const objectCount = storageData.max?.objectCount || 0;

    return {
      totalBytes: payloadSize + metadataSize,
      totalFiles: objectCount,
    };
  } catch (error) {
    console.error("Failed to query R2 storage metrics:", error);
    return null;
  }
}

/**
 * Calculate storage breakdown by file type from database
 *
 * @param prisma - Prisma client instance
 * @returns Breakdown of storage by models, slices, and images
 */
async function calculateDatabaseBreakdown(prisma: PrismaClient): Promise<{
  models: { count: number; bytes: number };
  slices: { count: number; bytes: number };
  images: { count: number; bytes: number };
}> {
  let modelsTotal = 0;
  let modelsCount = 0;
  let slicesTotal = 0;
  let slicesCount = 0;

  try {
    // Query models table
    const models = await prisma.model.findMany({
      select: { fileSize: true },
    });
    modelsTotal = models.reduce(
      (sum: number, m: { fileSize: number }) => sum + m.fileSize,
      0,
    );
    modelsCount = models.length;
  } catch {
    // Handle any database errors gracefully
  }

  try {
    // Query slices table
    const slices = await prisma.slice.findMany({
      select: { fileSize: true },
    });
    slicesTotal = slices.reduce(
      (sum: number, s: { fileSize: number }) => sum + s.fileSize,
      0,
    );
    slicesCount = slices.length;
  } catch {
    // Handle any database errors gracefully
  }

  // Images will be tracked separately in future stories
  const imagesCount = 0;
  const imagesTotal = 0;

  return {
    models: { count: modelsCount, bytes: modelsTotal },
    slices: { count: slicesCount, bytes: slicesTotal },
    images: { count: imagesCount, bytes: imagesTotal },
  };
}

/**
 * Calculate total storage usage using hybrid approach
 *
 * @param prisma - Prisma client instance
 * @param cloudflareConfig - Optional Cloudflare configuration for R2 API access
 * @returns Storage usage breakdown with totals and percentage of free tier limit
 *
 * @remarks
 * **Hybrid Approach:**
 * - Total storage from R2 GraphQL API (authoritative, matches billing)
 * - Breakdown by file type from database (application-level categorization)
 *
 * **Fallback Strategy:**
 * - If R2 API unavailable or config missing → use database totals
 * - If database tables don't exist → return zero values
 *
 * **Performance:**
 * This is an expensive operation. Callers should:
 * - Cache results with appropriate stale time (recommended: 5 minutes)
 * - Avoid frequent recalculations
 * - Consider background calculation via Cloudflare Workers Cron at scale
 *
 * @example
 * ```typescript
 * // With R2 integration
 * const usage = await calculateStorageUsage(prisma, {
 *   accountId: 'your-account-id',
 *   apiToken: 'your-api-token',
 *   bucketName: 'your-bucket-name'
 * })
 *
 * // Database-only fallback
 * const usage = await calculateStorageUsage(prisma)
 * ```
 */
export async function calculateStorageUsage(
  prisma: PrismaClient,
  cloudflareConfig?: CloudflareConfig,
): Promise<StorageUsage> {
  // Get breakdown from database
  const breakdown = await calculateDatabaseBreakdown(prisma);

  // Try to get authoritative totals from R2
  let totalBytes = 0;
  let totalFiles = 0;
  let source: "r2" | "database" | "hybrid" = "database";

  if (cloudflareConfig) {
    const r2Metrics = await queryR2StorageMetrics(cloudflareConfig);

    if (r2Metrics !== null) {
      // Use R2 as source of truth for totals
      totalBytes = r2Metrics.totalBytes;
      totalFiles = r2Metrics.totalFiles;
      source = "hybrid";
    } else {
      // Fallback to database totals
      totalBytes =
        breakdown.models.bytes +
        breakdown.slices.bytes +
        breakdown.images.bytes;
      totalFiles =
        breakdown.models.count +
        breakdown.slices.count +
        breakdown.images.count;
      source = "database";
    }
  } else {
    // No R2 config provided, use database only
    totalBytes =
      breakdown.models.bytes + breakdown.slices.bytes + breakdown.images.bytes;
    totalFiles =
      breakdown.models.count + breakdown.slices.count + breakdown.images.count;
    source = "database";
  }

  const percentOfLimit = (totalBytes / FREE_TIER_LIMIT_BYTES) * 100;

  return {
    totalBytes,
    totalFiles,
    breakdown,
    percentOfLimit,
    lastCalculated: new Date(),
    source,
  };
}

/**
 * Format bytes into human-readable string (KB, MB, GB, TB)
 *
 * @param bytes - Number of bytes to format
 * @returns Formatted string with appropriate unit
 *
 * @example
 * formatBytes(0)           // "0 Bytes"
 * formatBytes(1024)        // "1.00 KB"
 * formatBytes(1048576)     // "1.00 MB"
 * formatBytes(10737418240) // "10.00 GB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

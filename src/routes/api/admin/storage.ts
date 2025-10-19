import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { getPrismaClient } from "~/lib/db";
import { calculateStorageUsage } from "~/lib/storage/usage";
import { log } from "~/lib/utils/logger";
import type { CloudflareConfig } from "~/lib/storage/usage";

export const Route = createFileRoute("/api/admin/storage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const startTime = Date.now();

        try {
          // Get database connection
          const databaseUrl = process.env.DATABASE_URL;

          if (!databaseUrl) {
            log("storage_api_error", {
              method: request.method,
              path: new URL(request.url).pathname,
              error: "DATABASE_URL not configured",
              status: 500,
            });

            return json(
              {
                error: "Database not configured",
                message: "DATABASE_URL environment variable is required",
              },
              { status: 500 },
            );
          }

          const { prisma, pool } = getPrismaClient(databaseUrl);

          try {
            // Prepare Cloudflare R2 config if available
            let cloudflareConfig: CloudflareConfig | undefined;

            const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
            const apiToken = process.env.CLOUDFLARE_API_TOKEN;
            const bucketName = process.env.R2_BUCKET_NAME || "printfarm-files";

            if (accountId && apiToken) {
              cloudflareConfig = {
                accountId,
                apiToken,
                bucketName,
              };
            }

            // Calculate storage usage
            const usage = await calculateStorageUsage(prisma, cloudflareConfig);

            const durationMs = Date.now() - startTime;

            // Log successful calculation
            log("storage_calculated", {
              method: request.method,
              path: new URL(request.url).pathname,
              status: 200,
              durationMs,
              totalBytes: usage.totalBytes,
              totalFiles: usage.totalFiles,
              percentOfLimit: usage.percentOfLimit,
              source: usage.source,
            });

            return json(usage);
          } finally {
            // Clean up database connection
            try {
              await Promise.all([prisma.$disconnect(), pool.end()]);
            } catch (cleanupError) {
              console.error("Connection cleanup failed:", cleanupError);
              // Don't re-throw - preserve original error if any
            }
          }
        } catch (error) {
          const durationMs = Date.now() - startTime;

          log("storage_api_error", {
            method: request.method,
            path: new URL(request.url).pathname,
            error: error instanceof Error ? error.message : "Unknown error",
            status: 500,
            durationMs,
          });

          return json(
            {
              error: "Failed to calculate storage usage",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});

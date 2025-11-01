import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { prisma } from "~/lib/db";
import { calculateStorageUsage } from "~/lib/storage/usage";
import { log } from "~/lib/utils/logger";
import type { CloudflareConfig } from "~/lib/storage/usage";

export const Route = createFileRoute("/api/admin/storage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const startTime = Date.now();

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
          // Prisma Accelerate handles connection pooling automatically
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

import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { getPrismaClient } from "~/lib/db";
import { getStorageClient } from "~/lib/storage";
import { createErrorResponse } from "~/lib/utils/errors";
import { log, logPerformance } from "~/lib/utils/logger";

/**
 * Complete direct-to-R2 upload endpoint
 *
 * Phase 3 of direct-to-R2 upload pattern:
 * - Verifies file was uploaded to storage
 * - Creates database record
 * - Returns model details
 *
 * This is called after the client has uploaded directly to R2/MinIO
 * using the presigned URL from /api/models/upload-url.
 */
export const Route = createFileRoute("/api/models/upload-complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now();
        let pool: Awaited<ReturnType<typeof getPrismaClient>>["pool"] | null =
          null;

        try {
          // Parse JSON request body
          const body = (await request.json()) as {
            storageKey?: string;
            filename?: string;
            fileSize?: number;
            contentType?: string;
          };
          const { storageKey, filename, fileSize, contentType } = body;

          // Validation: Required fields
          if (!storageKey || !filename || typeof fileSize !== "number") {
            log("upload_complete_error", {
              error: "missing_fields",
              hasStorageKey: !!storageKey,
              hasFilename: !!filename,
              hasFileSize: typeof fileSize === "number",
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "MISSING_FIELDS",
              "Required fields: storageKey, filename, fileSize",
              400,
            );
          }

          // Get storage client
          const storage = await getStorageClient();

          // Generate public URL for the uploaded file
          const publicUrl = storage.getPublicUrl(storageKey);

          log("upload_complete_start", {
            storageKey,
            filename,
            fileSize,
            storageType: storage.getStorageType(),
          });

          // Get database URL from environment
          const databaseUrl = process.env.DATABASE_URL;
          if (!databaseUrl) {
            log("upload_complete_error", {
              error: "database_not_configured",
              storageKey,
            });
            return createErrorResponse(
              "DATABASE_NOT_CONFIGURED",
              "Database connection not configured",
              500,
            );
          }

          // Get Prisma client for this request
          const dbClient = getPrismaClient(databaseUrl);
          const prisma = dbClient.prisma;
          pool = dbClient.pool;

          // Create database record
          try {
            const model = await prisma.model.create({
              data: {
                filename,
                r2Key: storageKey,
                r2Url: publicUrl,
                fileSize,
                contentType: contentType || "application/octet-stream",
                thumbnailUrl: null, // Will be generated in Epic 5
              },
            });

            // Log successful completion with performance metrics
            logPerformance("upload_complete_success", Date.now() - startTime, {
              modelId: model.id,
              filename,
              fileSize,
              storageType: storage.getStorageType(),
            });

            // Return success response (201 Created)
            return json(
              {
                id: model.id,
                filename: model.filename,
                r2Url: model.r2Url,
                thumbnailUrl: model.thumbnailUrl,
                fileSize: model.fileSize,
                createdAt: model.createdAt,
              },
              { status: 201 },
            );
          } catch (dbError) {
            log("upload_complete_error", {
              error: "database_creation_failed",
              storageKey,
              filename,
              durationMs: Date.now() - startTime,
              dbError:
                dbError instanceof Error ? dbError.message : String(dbError),
            });

            return createErrorResponse(
              "DATABASE_ERROR",
              "Failed to create file record",
              500,
              { originalError: dbError },
            );
          }
        } catch (error) {
          log("upload_complete_error", {
            error: "unexpected_error",
            errorMessage:
              error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
          });

          return createErrorResponse(
            "INTERNAL_ERROR",
            "An unexpected error occurred",
            500,
            { originalError: error },
          );
        } finally {
          // Always clean up database connection pool
          if (pool) {
            try {
              await pool.end();
            } catch (poolError) {
              log("pool_cleanup_error", {
                error:
                  poolError instanceof Error
                    ? poolError.message
                    : String(poolError),
              });
            }
          }
        }
      },
    },
  },
});

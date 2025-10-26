import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { getPrismaClient } from "~/lib/db";
import { getStorageClient } from "~/lib/storage";
import { createErrorResponse } from "~/lib/utils/errors";
import { log, logPerformance } from "~/lib/utils/logger";

// File validation constants (per FR-1, NFR-2)
const MODEL_EXTENSIONS = [".stl", ".3mf"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const ALLOWED_EXTENSIONS = [...MODEL_EXTENSIONS, ...IMAGE_EXTENSIONS];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB per file

/**
 * Determines file type based on extension
 */
function getFileType(filename: string): "model" | "image" | "unknown" {
  const extension = filename.substring(filename.lastIndexOf(".")).toLowerCase();

  if (MODEL_EXTENSIONS.includes(extension)) {
    return "model";
  }

  if (IMAGE_EXTENSIONS.includes(extension)) {
    return "image";
  }

  return "unknown";
}

/**
 * Checks if file has allowed extension
 */
function isAllowedFile(filename: string): boolean {
  const extension = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(extension);
}

interface ImportedFileResult {
  id: string;
  filename: string;
  r2Url: string;
  type: "model" | "image" | "unknown";
  size: number;
}

interface FailedFileResult {
  filename: string;
  error: string;
  message: string;
}

interface ImportResponse {
  imported: ImportedFileResult[];
  failed: FailedFileResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    totalBytes: number;
  };
}

/**
 * Bulk Import API Endpoint
 *
 * Imports multiple files that were already extracted client-side (Story 2.3).
 * This endpoint receives the extracted file Blobs directly, NOT a zip file.
 *
 * CRITICAL: Client-side extraction is required because Cloudflare Workers
 * has only 128MB memory, insufficient for large zip files. The client must
 * extract files in the browser and send the Blobs to this endpoint.
 *
 * For each file:
 * 1. Validates file type and size
 * 2. Uploads to storage (R2/MinIO)
 * 3. Creates database record
 * 4. Returns mixed success/failure results (partial success supported)
 *
 * Reuses Story 2.2 atomic upload pattern per file:
 * - Upload to storage first
 * - Create database record second
 * - Cleanup storage on DB failure
 */
export const Route = createFileRoute("/api/models/import-zip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now();
        let pool: Awaited<ReturnType<typeof getPrismaClient>>["pool"] | null =
          null;

        try {
          // Parse multipart form data containing extracted files
          const formData = await request.formData();

          // Extract all files from form data
          // Files are sent as: file_0, file_1, file_2, etc.
          const files: File[] = [];
          let fileIndex = 0;
          while (true) {
            const file = formData.get(`file_${fileIndex}`) as File | null;
            if (!file) break;
            files.push(file);
            fileIndex++;
          }

          // Validation: At least one file
          if (files.length === 0) {
            log("bulk_import_error", {
              error: "no_files_provided",
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "NO_FILES_PROVIDED",
              "No files provided for import",
              400,
            );
          }

          log("bulk_import_start", {
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
          });

          // Get environment-appropriate storage client
          const storage = await getStorageClient();

          // Get database configuration
          const databaseUrl = process.env.DATABASE_URL;
          if (!databaseUrl) {
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

          // Process each file
          const imported: ImportedFileResult[] = [];
          const failed: FailedFileResult[] = [];
          let totalBytes = 0;

          for (const file of files) {
            const filename = file.name;

            // Validate file extension
            if (!isAllowedFile(filename)) {
              failed.push({
                filename,
                error: "INVALID_FILE_TYPE",
                message: `File type not allowed. Only ${ALLOWED_EXTENSIONS.join(", ")} files are accepted`,
              });
              continue;
            }

            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
              failed.push({
                filename,
                error: "FILE_TOO_LARGE",
                message: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
              });
              continue;
            }

            try {
              // Determine file type
              const fileType = getFileType(filename);

              // Generate unique storage key
              const extension = filename.substring(filename.lastIndexOf("."));
              const storageKey =
                fileType === "model"
                  ? `models/${crypto.randomUUID()}${extension}`
                  : `images/${crypto.randomUUID()}${extension}`;

              // Upload to storage (atomicity step 1)
              try {
                await storage.uploadFile(storageKey, file, {
                  contentType: file.type || "application/octet-stream",
                  contentDisposition: `attachment; filename="${filename}"`,
                });
              } catch {
                log("bulk_import_file_error", {
                  error: "storage_upload_failed",
                  filename,
                  storageKey,
                });
                failed.push({
                  filename,
                  error: "STORAGE_UPLOAD_FAILED",
                  message: "Failed to upload file to storage",
                });
                continue;
              }

              // Generate public URL
              const publicUrl = storage.getPublicUrl(storageKey);

              // Create database record (atomicity step 2)
              try {
                const model = await prisma.model.create({
                  data: {
                    filename,
                    r2Key: storageKey,
                    r2Url: publicUrl,
                    fileSize: file.size,
                    contentType: file.type || "application/octet-stream",
                    thumbnailUrl: null, // Will be generated in Epic 5
                  },
                });

                // Success!
                imported.push({
                  id: model.id,
                  filename: model.filename,
                  r2Url: model.r2Url,
                  type: fileType,
                  size: model.fileSize,
                });

                totalBytes += file.size;

                log("bulk_import_file_success", {
                  filename,
                  modelId: model.id,
                  size: file.size,
                });
              } catch {
                // Cleanup: Delete storage file if database creation fails
                try {
                  await storage.delete(storageKey);
                  log("bulk_import_cleanup_success", {
                    storageKey,
                    filename,
                    reason: "database_creation_failed",
                  });
                } catch {
                  log("bulk_import_cleanup_failed", {
                    error: "cleanup_failed",
                    storageKey,
                    filename,
                  });
                }

                log("bulk_import_file_error", {
                  error: "database_creation_failed",
                  filename,
                  storageKey,
                });

                failed.push({
                  filename,
                  error: "DATABASE_ERROR",
                  message: "Failed to create file record in database",
                });
              }
            } catch {
              log("bulk_import_file_error", {
                error: "file_processing_failed",
                filename,
              });
              failed.push({
                filename,
                error: "FILE_PROCESSING_ERROR",
                message: "Failed to process file",
              });
            }
          }

          // Log bulk import completion
          logPerformance("bulk_import_complete", Date.now() - startTime, {
            totalRequested: files.length,
            succeeded: imported.length,
            failed: failed.length,
            totalBytes,
            storageType: storage.getStorageType(),
          });

          // Return mixed success/failure response
          const response: ImportResponse = {
            imported,
            failed,
            summary: {
              total: files.length,
              succeeded: imported.length,
              failed: failed.length,
              totalBytes,
            },
          };

          return json(response, { status: 200 });
        } catch (error) {
          // Catch-all for unexpected errors
          log("bulk_import_error", {
            error: "unexpected_error",
            errorMessage:
              error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
          });

          return createErrorResponse(
            "INTERNAL_ERROR",
            "An unexpected error occurred during bulk import",
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

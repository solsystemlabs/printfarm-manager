import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import JSZip from "jszip";
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
 * Imports multiple files from a zip archive. This endpoint:
 * 1. Re-extracts the uploaded zip file (client already extracted once for preview)
 * 2. Filters to selected file paths only
 * 3. Uploads each file individually to storage (R2/MinIO)
 * 4. Creates database record for each uploaded file
 * 5. Returns mixed success/failure results (partial success supported)
 *
 * Reuses Story 2.2 atomic upload pattern:
 * - Upload to storage first
 * - Create database record second
 * - Cleanup storage on DB failure
 *
 * Each file upload is atomic, but batch is not atomic (allows partial success).
 */
export const Route = createFileRoute("/api/models/import-zip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now();
        let pool: Awaited<ReturnType<typeof getPrismaClient>>["pool"] | null =
          null;

        try {
          // Parse multipart form data
          const formData = await request.formData();
          const zipFile = formData.get("file") as File | null;
          const selectedPathsJson = formData.get("selectedPaths") as
            | string
            | null;

          // Validation: Missing file
          if (!zipFile) {
            log("bulk_import_error", {
              error: "missing_file",
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "MISSING_FILE",
              "No zip file provided in request",
              400,
            );
          }

          // Validation: Missing selectedPaths
          if (!selectedPathsJson) {
            log("bulk_import_error", {
              error: "missing_selected_paths",
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "MISSING_SELECTED_PATHS",
              "No selected file paths provided",
              400,
            );
          }

          // Parse selected paths
          let selectedPaths: string[];
          try {
            selectedPaths = JSON.parse(selectedPathsJson);
            if (!Array.isArray(selectedPaths)) {
              throw new Error("selectedPaths must be an array");
            }
          } catch {
            log("bulk_import_error", {
              error: "invalid_selected_paths",
              selectedPathsJson,
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "INVALID_SELECTED_PATHS",
              "selectedPaths must be a valid JSON array of file paths",
              400,
            );
          }

          // Validation: At least one file selected
          if (selectedPaths.length === 0) {
            log("bulk_import_error", {
              error: "no_files_selected",
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "NO_FILES_SELECTED",
              "At least one file must be selected for import",
              400,
            );
          }

          log("bulk_import_start", {
            zipFilename: zipFile.name,
            zipSize: zipFile.size,
            selectedCount: selectedPaths.length,
          });

          // Re-extract zip file (client already extracted once for preview)
          let zip: JSZip;
          try {
            zip = await JSZip.loadAsync(zipFile, { checkCRC32: true });
          } catch (extractError) {
            log("bulk_import_error", {
              error: "zip_extraction_failed",
              zipFilename: zipFile.name,
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "ZIP_EXTRACTION_FAILED",
              "Failed to extract zip file. File may be corrupted.",
              422,
              { originalError: extractError },
            );
          }

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

          // Process each selected file
          const imported: ImportedFileResult[] = [];
          const failed: FailedFileResult[] = [];
          let totalBytes = 0;

          for (const path of selectedPaths) {
            const zipEntry = zip.file(path);

            // File not found in zip
            if (!zipEntry) {
              failed.push({
                filename: path.split("/").pop() || path,
                error: "FILE_NOT_FOUND_IN_ZIP",
                message: `File not found in zip archive: ${path}`,
              });
              continue;
            }

            // Skip directories
            if (zipEntry.dir) {
              failed.push({
                filename: path.split("/").pop() || path,
                error: "DIRECTORY_NOT_SUPPORTED",
                message: `Cannot import directories: ${path}`,
              });
              continue;
            }

            const filename = path.split("/").pop() || path;

            // Validate file extension
            if (!isAllowedFile(filename)) {
              failed.push({
                filename,
                error: "INVALID_FILE_TYPE",
                message: `File type not allowed. Only ${ALLOWED_EXTENSIONS.join(", ")} files are accepted`,
              });
              continue;
            }

            try {
              // Extract file content as Blob
              const content = await zipEntry.async("blob");

              // Validate file size
              if (content.size > MAX_FILE_SIZE) {
                failed.push({
                  filename,
                  error: "FILE_TOO_LARGE",
                  message: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                });
                continue;
              }

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
                // Convert Blob to File for storage API
                const file = new File([content], filename, {
                  type: content.type || "application/octet-stream",
                });

                await storage.uploadFile(storageKey, file, {
                  contentType: file.type,
                  contentDisposition: `attachment; filename="${filename}"`,
                });
              } catch {
                log("bulk_import_file_error", {
                  error: "storage_upload_failed",
                  filename,
                  path,
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
                    fileSize: content.size,
                    contentType: content.type || "application/octet-stream",
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

                totalBytes += content.size;

                log("bulk_import_file_success", {
                  filename,
                  modelId: model.id,
                  size: content.size,
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
                  path,
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
                path,
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
            totalRequested: selectedPaths.length,
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
              total: selectedPaths.length,
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

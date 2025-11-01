import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { prisma } from "~/lib/db";
import { getStorageClient } from "~/lib/storage";
import { createErrorResponse } from "~/lib/utils/errors";
import { log, logPerformance } from "~/lib/utils/logger";

// File upload validation constants (per FR-1, NFR-2)
const ALLOWED_EXTENSIONS = [".stl", ".3mf"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

/**
 * Model file upload API endpoint
 *
 * Implements atomic upload pattern (per NFR-4):
 * 1. Upload to storage (R2 or MinIO) first
 * 2. Create database record second
 * 3. Cleanup storage on database failure
 *
 * This ensures no orphaned database records pointing to missing files.
 */
export const Route = createFileRoute("/api/models/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now();

        try {
          // Get environment-appropriate storage client (MinIO for dev, R2 for staging/prod)
          const storage = await getStorageClient();

          // Parse multipart form data
          const formData = await request.formData();
          const file = formData.get("file") as File | null;

          // Validation: Missing file
          if (!file) {
            log("model_upload_error", {
              error: "missing_file",
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "MISSING_FILE",
              "No file provided in request",
              400,
            );
          }

          // Log upload start
          log("model_upload_start", {
            filename: file.name,
            size: file.size,
            contentType: file.type,
          });

          // Validation: File extension
          const extension = file.name.substring(file.name.lastIndexOf("."));
          if (!ALLOWED_EXTENSIONS.includes(extension.toLowerCase())) {
            log("model_upload_error", {
              error: "invalid_file_type",
              filename: file.name,
              extension,
              allowedExtensions: ALLOWED_EXTENSIONS,
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "INVALID_FILE_TYPE",
              `File type not allowed. Only ${ALLOWED_EXTENSIONS.join(", ")} files are accepted`,
              400,
              {
                field: "file",
                details: { extension, allowedExtensions: ALLOWED_EXTENSIONS },
              },
            );
          }

          // Validation: File size
          if (file.size > MAX_FILE_SIZE) {
            log("model_upload_error", {
              error: "file_too_large",
              filename: file.name,
              size: file.size,
              maxSize: MAX_FILE_SIZE,
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "FILE_TOO_LARGE",
              `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
              413,
              {
                field: "file",
                details: {
                  fileSize: file.size,
                  maxSize: MAX_FILE_SIZE,
                },
              },
            );
          }

          // Generate unique storage key using UUID
          const storageKey = `models/${crypto.randomUUID()}${extension}`;

          // Upload to storage with proper headers (per FR-16)
          try {
            await storage.uploadFile(storageKey, file, {
              contentType: file.type || "application/octet-stream",
              contentDisposition: `attachment; filename="${file.name}"`,
            });
          } catch (uploadError) {
            log("model_upload_error", {
              error: "storage_upload_failed",
              phase: "storage_upload",
              storageType: storage.getStorageType(),
              filename: file.name,
              storageKey,
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "UPLOAD_FAILED",
              "Failed to upload file to storage",
              500,
              { originalError: uploadError },
            );
          }

          // Generate public URL for the uploaded file
          const publicUrl = storage.getPublicUrl(storageKey);

          // Create database record (atomic operation - cleanup storage on failure)
          // Prisma Accelerate handles connection pooling automatically
          try {
            const model = await prisma.model.create({
              data: {
                filename: file.name,
                r2Key: storageKey,
                r2Url: publicUrl,
                fileSize: file.size,
                contentType: file.type || "application/octet-stream",
                thumbnailUrl: null, // Will be generated in Epic 5
              },
            });

            // Log successful upload with performance metrics
            logPerformance("model_upload_complete", Date.now() - startTime, {
              modelId: model.id,
              filename: file.name,
              size: file.size,
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
            // Cleanup: Delete storage file if database creation fails (atomic operation per NFR-4)
            try {
              await storage.delete(storageKey);
              log("model_upload_cleanup_success", {
                storageKey,
                reason: "database_creation_failed",
              });
            } catch (cleanupError) {
              log("model_upload_cleanup_failed", {
                error: "cleanup_failed",
                storageKey,
                cleanupError:
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : String(cleanupError),
              });
            }

            log("model_upload_error", {
              error: "database_creation_failed",
              phase: "database_create",
              filename: file.name,
              storageKey,
              durationMs: Date.now() - startTime,
            });

            return createErrorResponse(
              "DATABASE_ERROR",
              "Failed to create file record",
              500,
              { originalError: dbError },
            );
          }
        } catch (error) {
          // Catch-all for unexpected errors
          log("model_upload_error", {
            error: "unexpected_error",
            phase: "unexpected",
            errorMessage:
              error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
          });

          return createErrorResponse(
            "INTERNAL_ERROR",
            "An unexpected error occurred during upload",
            500,
            { originalError: error },
          );
        }
        // Note: No cleanup needed - Prisma Accelerate handles connection pooling
      },
    },
  },
});

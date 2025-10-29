import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { getStorageClient } from "~/lib/storage";
import { createErrorResponse } from "~/lib/utils/errors";
import { log } from "~/lib/utils/logger";

// File upload validation constants (same as upload.ts)
const ALLOWED_EXTENSIONS = [".stl", ".3mf", ".png", ".jpg", ".jpeg"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

/**
 * Generate presigned upload URL endpoint
 *
 * Phase 1 of direct-to-R2 upload pattern:
 * - Validates file metadata (name, size, type)
 * - Generates unique storage key
 * - Returns presigned URL for direct client upload
 *
 * This bypasses Netlify's 6MB function payload limit by allowing
 * clients to upload directly to R2/MinIO.
 */
export const Route = createFileRoute("/api/models/upload-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now();

        try {
          // Parse JSON request body
          const body = (await request.json()) as {
            filename?: string;
            contentType?: string;
            fileSize?: number;
          };
          const { filename, contentType, fileSize } = body;

          // Validation: Required fields
          if (!filename || typeof fileSize !== "number") {
            log("upload_url_error", {
              error: "missing_fields",
              hasFilename: !!filename,
              hasFileSize: typeof fileSize === "number",
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "MISSING_FIELDS",
              "Required fields: filename, fileSize",
              400,
            );
          }

          // Validation: File extension
          const extension = filename.substring(filename.lastIndexOf("."));
          if (!ALLOWED_EXTENSIONS.includes(extension.toLowerCase())) {
            log("upload_url_error", {
              error: "invalid_file_type",
              filename,
              extension,
              allowedExtensions: ALLOWED_EXTENSIONS,
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "INVALID_FILE_TYPE",
              `File type not allowed. Only ${ALLOWED_EXTENSIONS.join(", ")} files are accepted`,
              400,
              {
                field: "filename",
                details: { extension, allowedExtensions: ALLOWED_EXTENSIONS },
              },
            );
          }

          // Validation: File size
          if (fileSize > MAX_FILE_SIZE) {
            log("upload_url_error", {
              error: "file_too_large",
              filename,
              size: fileSize,
              maxSize: MAX_FILE_SIZE,
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "FILE_TOO_LARGE",
              `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
              413,
              {
                field: "fileSize",
                details: {
                  fileSize,
                  maxSize: MAX_FILE_SIZE,
                },
              },
            );
          }

          // Get storage client
          const storage = await getStorageClient();

          // Generate unique storage key
          const storageKey = `models/${crypto.randomUUID()}${extension}`;

          // Generate presigned upload URL (valid for 1 hour)
          const uploadUrl = await storage.generatePresignedUploadUrl(
            storageKey,
            contentType || "application/octet-stream",
            3600, // 1 hour expiration
          );

          const expiresAt = new Date(Date.now() + 3600000).toISOString();

          log("upload_url_generated", {
            filename,
            storageKey,
            fileSize,
            expiresAt,
            storageType: storage.getStorageType(),
            durationMs: Date.now() - startTime,
          });

          return json({
            uploadUrl,
            storageKey,
            expiresAt,
          });
        } catch (error) {
          log("upload_url_error", {
            error: "unexpected_error",
            errorMessage:
              error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
          });

          return createErrorResponse(
            "INTERNAL_ERROR",
            "Failed to generate upload URL",
            500,
            { originalError: error },
          );
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { handleUploadCompletion } from "~/lib/utils/upload-handlers";

// File upload validation constants (per FR-1, NFR-2)
const ALLOWED_EXTENSIONS = [".stl", ".3mf", ".png", ".jpg", ".jpeg"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

/**
 * Complete direct-to-R2 upload endpoint for model files
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
        return handleUploadCompletion(
          request,
          {
            allowedExtensions: ALLOWED_EXTENSIONS,
            maxFileSize: MAX_FILE_SIZE,
            storagePrefix: "models/",
            entityType: "model",
          },
          async (prisma, data) => {
            // Create model database record
            const model = await prisma.model.create({
              data: {
                filename: data.filename,
                r2Key: data.storageKey,
                r2Url: data.publicUrl,
                fileSize: data.fileSize,
                contentType: data.contentType,
                thumbnailUrl: null, // Will be generated in Epic 5
              },
            });

            // Return in expected format
            return {
              id: model.id,
              filename: model.filename,
              r2Url: model.r2Url,
              thumbnailUrl: model.thumbnailUrl,
              fileSize: model.fileSize,
              createdAt: model.createdAt,
            };
          },
        );
      },
    },
  },
});

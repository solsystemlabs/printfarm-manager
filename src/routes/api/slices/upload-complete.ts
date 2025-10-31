import { createFileRoute } from "@tanstack/react-router";
import { handleUploadCompletion } from "~/lib/utils/upload-handlers";

// File upload validation constants (per FR-2, NFR-2)
const ALLOWED_EXTENSIONS = [".gcode.3mf", ".gcode"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

/**
 * Complete direct-to-R2 slice upload endpoint
 *
 * Phase 3 of direct-to-R2 upload pattern:
 * - Verifies file was uploaded to storage
 * - Creates database record with metadataExtracted = false (AC#7)
 * - Returns slice details
 *
 * This is called after the client has uploaded directly to R2/MinIO
 * using the presigned URL from /api/slices/upload-url.
 */
export const Route = createFileRoute("/api/slices/upload-complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return handleUploadCompletion(
          request,
          {
            allowedExtensions: ALLOWED_EXTENSIONS,
            maxFileSize: MAX_FILE_SIZE,
            storagePrefix: "slices/",
            entityType: "slice",
          },
          async (prisma, data) => {
            // Create slice database record with metadataExtracted = false (AC#7)
            const slice = await prisma.slice.create({
              data: {
                filename: data.filename,
                r2Key: data.storageKey,
                r2Url: data.publicUrl,
                fileSize: data.fileSize,
                contentType: data.contentType,
                thumbnailUrl: null, // Will be generated in Epic 5
                metadataExtracted: false, // Deferred to Epic 3 (AC#7)
              },
            });

            // Return in expected format per AC#8
            return {
              id: slice.id,
              filename: slice.filename,
              r2Url: slice.r2Url,
              thumbnailUrl: slice.thumbnailUrl,
              metadataExtracted: slice.metadataExtracted,
              fileSize: slice.fileSize,
              createdAt: slice.createdAt,
            };
          },
        );
      },
    },
  },
});

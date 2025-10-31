import { createFileRoute } from "@tanstack/react-router";
import { handlePresignedUrlGeneration } from "~/lib/utils/upload-handlers";

// File upload validation constants (per FR-2, NFR-2)
// Order matters: check .gcode.3mf BEFORE .gcode to avoid false positives
const ALLOWED_EXTENSIONS = [".gcode.3mf", ".gcode"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

/**
 * Generate presigned upload URL endpoint for slice files
 *
 * Phase 1 of direct-to-R2 upload pattern:
 * - Validates file metadata (name, size, type)
 * - Generates unique storage key with slices/ prefix
 * - Returns presigned URL for direct client upload
 *
 * This bypasses Netlify's 6MB function payload limit by allowing
 * clients to upload directly to R2/MinIO.
 */
export const Route = createFileRoute("/api/slices/upload-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return handlePresignedUrlGeneration(request, {
          allowedExtensions: ALLOWED_EXTENSIONS,
          maxFileSize: MAX_FILE_SIZE,
          storagePrefix: "slices/",
          entityType: "slice",
        });
      },
    },
  },
});

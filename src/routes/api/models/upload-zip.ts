import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { extractZipFile } from "~/lib/zip/extractor";
import { createErrorResponse } from "~/lib/utils/errors";
import { log, logPerformance } from "~/lib/utils/logger";

// File upload validation constants (per FR-1, NFR-2)
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

/**
 * Zip file upload and extraction API endpoint
 *
 * This endpoint handles bulk model/image import via zip files:
 * 1. Validates zip file (extension, size)
 * 2. Extracts contents in-memory using JSZip
 * 3. Filters for whitelisted file types (.stl, .3mf, .png, .jpg, .jpeg)
 * 4. Returns file list with metadata for user review
 *
 * NOTE: This endpoint does NOT upload to R2 or create database records.
 * That happens in Story 2.4 after user selects which files to import.
 *
 * Per tech spec lines 636-641, this two-phase approach allows users to
 * exclude unwanted files (promotional images, alternate versions) before
 * committing to storage.
 */
export const Route = createFileRoute("/api/models/upload-zip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startTime = Date.now();

        try {
          // Parse multipart form data
          const formData = await request.formData();
          const file = formData.get("file") as File | null;

          // Validation: Missing file
          if (!file) {
            log("zip_upload_error", {
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
          log("zip_upload_start", {
            filename: file.name,
            size: file.size,
          });

          // Validation: File extension (must be .zip)
          const extension = file.name.substring(file.name.lastIndexOf("."));
          if (extension.toLowerCase() !== ".zip") {
            log("zip_upload_error", {
              error: "invalid_file_type",
              filename: file.name,
              extension,
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "INVALID_FILE_TYPE",
              "File type not allowed. Only .zip files are accepted",
              400,
              {
                field: "file",
                details: { extension, allowedExtension: ".zip" },
              },
            );
          }

          // Validation: File size (≤500MB per NFR-2)
          if (file.size > MAX_FILE_SIZE) {
            log("zip_upload_error", {
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

          // Extract zip contents
          let extractionResult;
          try {
            extractionResult = await extractZipFile(file);
          } catch (extractionError) {
            // Handle malformed/corrupted zip files
            log("zip_upload_error", {
              error: "corrupted_zip",
              filename: file.name,
              extractionError:
                extractionError instanceof Error
                  ? extractionError.message
                  : String(extractionError),
              durationMs: Date.now() - startTime,
            });
            return createErrorResponse(
              "CORRUPTED_ZIP",
              "Zip file is malformed or corrupted and cannot be extracted",
              422,
              {
                field: "file",
                originalError: extractionError,
              },
            );
          }

          // Prepare response with file metadata (no Blob content - can't serialize)
          const filesMetadata = extractionResult.files.map((f) => ({
            path: f.path,
            filename: f.filename,
            type: f.type,
            size: f.size,
          }));

          // Log successful extraction
          logPerformance("zip_upload_complete", Date.now() - startTime, {
            filename: file.name,
            filesExtracted: extractionResult.totalFiles,
            models: extractionResult.models,
            images: extractionResult.images,
          });

          // Return file list for user selection (Story 2.4 will handle actual import)
          return json(
            {
              files: filesMetadata,
              totalFiles: extractionResult.totalFiles,
              models: extractionResult.models,
              images: extractionResult.images,
            },
            { status: 200 },
          );
        } catch (error) {
          // Catch-all for unexpected errors
          log("zip_upload_error", {
            error: "unexpected_error",
            errorMessage:
              error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
          });

          return createErrorResponse(
            "INTERNAL_ERROR",
            "An unexpected error occurred during zip extraction",
            500,
            { originalError: error },
          );
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { extractZipFile } from "~/lib/zip/extractor";
import { convertFileForZip } from "~/lib/zip/file-converter";
import { createErrorResponse } from "~/lib/utils/errors";
import { log, logPerformance } from "~/lib/utils/logger";
import { validateZipFile } from "~/lib/validation/zip-validators";

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

          // Validate zip file (presence, extension, size)
          const validationResult = validateZipFile(file);
          if (!validationResult.valid) {
            const { error } = validationResult;

            // Map error codes to HTTP status codes
            const statusCode = error.code === "FILE_TOO_LARGE" ? 413 : 400;

            // Log validation error
            log("zip_upload_error", {
              error: error.code.toLowerCase(),
              filename: file?.name,
              durationMs: Date.now() - startTime,
              ...error.details,
            });

            return createErrorResponse(error.code, error.message, statusCode, {
              field: error.field,
              details: error.details,
            });
          }

          // TypeScript now knows file is not null
          const validFile = file as File;

          // Log upload start
          log("zip_upload_start", {
            filename: validFile.name,
            size: validFile.size,
          });

          // Extract zip contents
          let extractionResult;
          try {
            // Convert File to Uint8Array using universal converter (works in all environments)
            const zipData = await convertFileForZip(validFile);
            extractionResult = await extractZipFile(zipData);
          } catch (extractionError) {
            // Handle malformed/corrupted zip files
            log("zip_upload_error", {
              error: "corrupted_zip",
              filename: validFile.name,
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
            filename: validFile.name,
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

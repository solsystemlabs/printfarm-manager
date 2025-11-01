/**
 * Shared upload handler utilities for presigned URL pattern
 *
 * Used by both model and slice upload endpoints to avoid code duplication.
 * Implements the 3-phase direct-to-storage upload pattern:
 * 1. Generate presigned URL (upload-url endpoint)
 * 2. Client uploads directly to storage
 * 3. Complete upload and create DB record (upload-complete endpoint)
 */

import { json } from "@tanstack/react-start";
import { prisma } from "~/lib/db";
import { getStorageClient } from "~/lib/storage";
import { createErrorResponse } from "./errors";
import { log, logPerformance } from "./logger";
import { getFileExtension } from "./file-validation";

/**
 * Upload configuration for different entity types
 */
export interface UploadConfig {
  allowedExtensions: string[]; // e.g., [".stl", ".3mf"] or [".gcode.3mf", ".gcode"]
  maxFileSize: number; // in bytes
  storagePrefix: string; // e.g., "models/" or "slices/"
  entityType: string; // e.g., "model" or "slice" (for logging)
}

/**
 * Handle presigned URL generation (Phase 1 of upload pattern)
 *
 * Validates file metadata and generates a presigned URL for direct upload.
 * This bypasses Netlify's 6MB function payload limit.
 *
 * @param request - The incoming request
 * @param config - Upload configuration for this entity type
 * @returns JSON response with uploadUrl, storageKey, expiresAt
 */
export async function handlePresignedUrlGeneration(
  request: Request,
  config: UploadConfig,
) {
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
      log(`${config.entityType}_upload_url_error`, {
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

    // Validation: File extension (handles multi-dot extensions)
    const extension = getFileExtension(filename, config.allowedExtensions);
    if (!extension) {
      log(`${config.entityType}_upload_url_error`, {
        error: "invalid_file_type",
        filename,
        allowedExtensions: config.allowedExtensions,
        durationMs: Date.now() - startTime,
      });
      return createErrorResponse(
        "INVALID_FILE_TYPE",
        `File type not allowed. Only ${config.allowedExtensions.join(", ")} files are accepted`,
        400,
        {
          field: "filename",
          details: { filename, allowedExtensions: config.allowedExtensions },
        },
      );
    }

    // Validation: File size
    if (fileSize > config.maxFileSize) {
      log(`${config.entityType}_upload_url_error`, {
        error: "file_too_large",
        filename,
        size: fileSize,
        maxSize: config.maxFileSize,
        durationMs: Date.now() - startTime,
      });
      return createErrorResponse(
        "FILE_TOO_LARGE",
        `File size exceeds maximum allowed size of ${config.maxFileSize / 1024 / 1024}MB`,
        413,
        {
          field: "fileSize",
          details: {
            fileSize,
            maxSize: config.maxFileSize,
          },
        },
      );
    }

    // Get storage client
    const storage = await getStorageClient();

    // Generate unique storage key
    const storageKey = `${config.storagePrefix}${crypto.randomUUID()}${extension}`;

    // Generate presigned upload URL (valid for 1 hour)
    const uploadUrl = await storage.generatePresignedUploadUrl(
      storageKey,
      contentType || "application/octet-stream",
      3600, // 1 hour expiration
    );

    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    log(`${config.entityType}_upload_url_generated`, {
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
    log(`${config.entityType}_upload_url_error`, {
      error: "unexpected_error",
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    return createErrorResponse(
      "INTERNAL_ERROR",
      "Failed to generate upload URL",
      500,
      { originalError: error },
    );
  }
}

/**
 * Database record creator function signature
 * Returns the created record which must have at minimum an 'id' field
 */
export type RecordCreator<T extends { id: string }> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prismaClient: any, // Accepts extended Prisma client
  data: {
    filename: string;
    storageKey: string;
    publicUrl: string;
    fileSize: number;
    contentType: string;
  },
) => Promise<T>;

/**
 * Handle upload completion (Phase 3 of upload pattern)
 *
 * Creates database record after client has uploaded directly to storage.
 *
 * @param request - The incoming request
 * @param config - Upload configuration for this entity type
 * @param createRecord - Function to create database record (entity-specific)
 * @returns JSON response with created record
 */
export async function handleUploadCompletion<
  T extends {
    id: string;
    filename: string;
    r2Url: string;
    fileSize: number;
    createdAt: Date;
  },
>(request: Request, config: UploadConfig, createRecord: RecordCreator<T>) {
  const startTime = Date.now();

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
      log(`${config.entityType}_upload_complete_error`, {
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

    log(`${config.entityType}_upload_complete_start`, {
      storageKey,
      filename,
      fileSize,
      storageType: storage.getStorageType(),
    });

    // Create database record (entity-specific logic)
    // Prisma Accelerate handles connection pooling automatically
    try {
      const record = await createRecord(prisma, {
        filename,
        storageKey,
        publicUrl,
        fileSize,
        contentType: contentType || "application/octet-stream",
      });

      // Log successful completion with performance metrics
      logPerformance(
        `${config.entityType}_upload_complete_success`,
        Date.now() - startTime,
        {
          [`${config.entityType}Id`]: record.id,
          filename,
          fileSize,
          storageType: storage.getStorageType(),
        },
      );

      // Return success response (201 Created)
      return json(record, { status: 201 });
    } catch (dbError) {
      log(`${config.entityType}_upload_complete_error`, {
        error: "database_creation_failed",
        storageKey,
        filename,
        durationMs: Date.now() - startTime,
        dbError: dbError instanceof Error ? dbError.message : String(dbError),
      });

      return createErrorResponse(
        "DATABASE_ERROR",
        "Failed to create file record",
        500,
        { originalError: dbError },
      );
    }
  } catch (error) {
    log(`${config.entityType}_upload_complete_error`, {
      error: "unexpected_error",
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    return createErrorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred",
      500,
      { originalError: error },
    );
  }
  // Note: No cleanup needed - Prisma Accelerate handles connection pooling
}

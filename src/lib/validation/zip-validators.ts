/**
 * Validation utilities for zip file uploads
 *
 * These validators follow the single-responsibility principle and can be
 * tested independently from the API endpoint logic.
 */

// File upload validation constants (per FR-1, NFR-2)
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes
export const ALLOWED_ZIP_EXTENSION = ".zip";

/**
 * Validation error with details
 */
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

/**
 * Result of a validation check
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: ValidationError };

/**
 * Validates that a file has the .zip extension
 *
 * @param filename - The filename to validate
 * @returns Validation result with error details if invalid
 */
export function validateZipExtension(filename: string): ValidationResult {
  const extension = filename.substring(filename.lastIndexOf("."));

  if (extension.toLowerCase() !== ALLOWED_ZIP_EXTENSION) {
    return {
      valid: false,
      error: {
        code: "INVALID_FILE_TYPE",
        message: "File type not allowed. Only .zip files are accepted",
        field: "file",
        details: { extension, allowedExtension: ALLOWED_ZIP_EXTENSION },
      },
    };
  }

  return { valid: true };
}

/**
 * Validates that a file size is within the allowed limit
 *
 * @param fileSize - The file size in bytes
 * @returns Validation result with error details if invalid
 */
export function validateZipSize(fileSize: number): ValidationResult {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        field: "file",
        details: {
          fileSize,
          maxSize: MAX_FILE_SIZE,
        },
      },
    };
  }

  return { valid: true };
}

/**
 * Validates that a file object is present
 *
 * @param file - The file object to validate
 * @returns Validation result with error details if invalid
 */
export function validateFilePresence(
  file: File | null | undefined,
): ValidationResult {
  if (!file) {
    return {
      valid: false,
      error: {
        code: "MISSING_FILE",
        message: "No file provided in request",
      },
    };
  }

  return { valid: true };
}

/**
 * Validates a zip file upload (presence, extension, and size)
 *
 * This is a convenience function that runs all zip file validations
 * in sequence and returns the first error encountered.
 *
 * @param file - The file to validate
 * @returns Validation result with error details if any validation fails
 */
export function validateZipFile(
  file: File | null | undefined,
): ValidationResult {
  // Check file presence
  const presenceResult = validateFilePresence(file);
  if (!presenceResult.valid) {
    return presenceResult;
  }

  // TypeScript now knows file is not null
  const validFile = file as File;

  // Check file extension
  const extensionResult = validateZipExtension(validFile.name);
  if (!extensionResult.valid) {
    return extensionResult;
  }

  // Check file size
  const sizeResult = validateZipSize(validFile.size);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  return { valid: true };
}

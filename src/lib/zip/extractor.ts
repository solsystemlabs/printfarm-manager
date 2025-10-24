import JSZip from "jszip";
import { log, logPerformance } from "~/lib/utils/logger";

/**
 * Extracted file metadata and content
 */
export interface ExtractedFile {
  /** Full path within the zip archive (e.g., 'models/whale/baby-whale.stl') */
  path: string;
  /** Filename only (e.g., 'baby-whale.stl') */
  filename: string;
  /** File type classification */
  type: "model" | "image" | "unknown";
  /** File size in bytes */
  size: number;
  /** File content as Blob */
  content: Blob;
}

/**
 * Result of zip extraction operation
 */
export interface ExtractionResult {
  /** List of all extracted files */
  files: ExtractedFile[];
  /** Total number of files found */
  totalFiles: number;
  /** Number of model files (.stl, .3mf) */
  models: number;
  /** Number of image files (.png, .jpg, .jpeg) */
  images: number;
}

// File type whitelists per FR-1
const MODEL_EXTENSIONS = [".stl", ".3mf"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const ALLOWED_EXTENSIONS = [...MODEL_EXTENSIONS, ...IMAGE_EXTENSIONS];

// System files to exclude
const EXCLUDED_PATTERNS = [
  /^\./, // Hidden files starting with .
  /__MACOSX/, // macOS resource fork directory
  /\.DS_Store$/, // macOS directory metadata
  /Thumbs\.db$/i, // Windows thumbnail cache
  /desktop\.ini$/i, // Windows folder settings
];

/**
 * Determines if a file should be excluded from extraction
 */
function shouldExcludeFile(path: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(path));
}

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
 * Checks if a file has a whitelisted extension
 */
function isAllowedFile(filename: string): boolean {
  const extension = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(extension);
}

/**
 * Gets current memory usage if available (for monitoring)
 *
 * Note: Memory monitoring APIs may not be available in all runtimes.
 * This function returns undefined if memory monitoring is unavailable.
 *
 * @returns Memory usage in bytes, or undefined if unavailable
 */
function getMemoryUsage(): number | undefined {
  // Check for performance.memory API (Chrome DevTools, some runtimes)
  if (typeof performance !== "undefined" && "memory" in performance) {
    const memory = performance.memory as { usedJSHeapSize?: number };
    return memory.usedJSHeapSize;
  }

  // Check for process.memoryUsage (Node.js)
  if (typeof process !== "undefined" && "memoryUsage" in process) {
    try {
      return process.memoryUsage().heapUsed;
    } catch {
      // process.memoryUsage may not be available in all environments
      return undefined;
    }
  }

  return undefined;
}

/**
 * Extracts a zip file and returns all valid files with metadata
 *
 * This function:
 * - Extracts zip contents in-memory using JSZip
 * - Recursively scans all directories (supports nested folders per FR-1)
 * - Filters files by extension whitelist (.stl, .3mf, .png, .jpg, .jpeg)
 * - Excludes hidden and system files (.DS_Store, __MACOSX, etc.)
 * - Returns file metadata and content for later processing
 *
 * @param zipData - The zip file as Uint8Array (universally compatible format)
 * @returns Extraction result with file list and statistics
 * @throws Error if zip is malformed/corrupted
 */
export async function extractZipFile(
  zipData: Uint8Array | Blob,
): Promise<ExtractionResult> {
  const startTime = Date.now();

  const size = zipData instanceof Blob ? zipData.size : zipData.byteLength;
  const memoryBefore = getMemoryUsage();

  log("zip_extraction_start", {
    size,
    memoryUsedBytes: memoryBefore,
  });

  try {
    // Load zip file using JSZip (Uint8Array is universally supported)
    // Enable CRC32 validation for enhanced corruption detection
    const zip = await JSZip.loadAsync(zipData, { checkCRC32: true });

    const extractedFiles: ExtractedFile[] = [];
    let modelCount = 0;
    let imageCount = 0;

    // Iterate through all entries in the zip (includes nested directories)
    for (const [path, zipEntry] of Object.entries(zip.files)) {
      // Skip directories (we only want files)
      if (zipEntry.dir) {
        continue;
      }

      // Skip system/hidden files
      if (shouldExcludeFile(path)) {
        continue;
      }

      // Extract filename from full path
      const filename = path.split("/").pop() || path;

      // Skip files that aren't in the whitelist
      if (!isAllowedFile(filename)) {
        continue;
      }

      // Extract file content as Blob
      const content = await zipEntry.async("blob");

      // Determine file type
      const type = getFileType(filename);

      // Count by type
      if (type === "model") {
        modelCount++;
      } else if (type === "image") {
        imageCount++;
      }

      // Add to results
      extractedFiles.push({
        path,
        filename,
        type,
        size: content.size,
        content,
      });
    }

    const result: ExtractionResult = {
      files: extractedFiles,
      totalFiles: extractedFiles.length,
      models: modelCount,
      images: imageCount,
    };

    // Log successful extraction with performance metrics
    const memoryAfter = getMemoryUsage();
    const memoryDelta =
      memoryBefore !== undefined && memoryAfter !== undefined
        ? memoryAfter - memoryBefore
        : undefined;

    logPerformance("zip_extraction_complete", Date.now() - startTime, {
      filesFound: result.totalFiles,
      models: result.models,
      images: result.images,
      memoryUsedBytes: memoryAfter,
      memoryDeltaBytes: memoryDelta,
    });

    return result;
  } catch (error) {
    // Log extraction failure
    log("zip_extraction_failed", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    throw error;
  }
}

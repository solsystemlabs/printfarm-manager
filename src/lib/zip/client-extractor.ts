import JSZip from "jszip";

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
  /** File content as Blob (for later upload) */
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
 * Extracts a zip file in the browser and returns all valid files with metadata
 *
 * This function runs CLIENT-SIDE to avoid Cloudflare Workers memory limits.
 * Modern browsers can handle large files (500MB+) without issues.
 *
 * Features:
 * - Extracts zip contents in-memory using JSZip
 * - Recursively scans all directories (supports nested folders per FR-1)
 * - Filters files by extension whitelist (.stl, .3mf, .png, .jpg, .jpeg)
 * - Excludes hidden and system files (.DS_Store, __MACOSX, etc.)
 * - Returns file metadata and content for later processing
 *
 * @param zipFile - The zip file from file input
 * @param onProgress - Optional callback for progress updates (0-100)
 * @returns Extraction result with file list and statistics
 * @throws Error if zip is malformed/corrupted
 */
export async function extractZipFile(
  zipFile: File | Blob,
  onProgress?: (progress: number) => void,
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    // Load zip file using JSZip
    // Enable CRC32 validation for enhanced corruption detection
    const zip = await JSZip.loadAsync(zipFile, { checkCRC32: true });

    const extractedFiles: ExtractedFile[] = [];
    let modelCount = 0;
    let imageCount = 0;

    // Get total number of files for progress tracking
    const allEntries = Object.entries(zip.files);
    const totalEntries = allEntries.length;
    let processedEntries = 0;

    // Iterate through all entries in the zip (includes nested directories)
    for (const [path, zipEntry] of allEntries) {
      // Skip directories (we only want files)
      if (zipEntry.dir) {
        processedEntries++;
        continue;
      }

      // Skip system/hidden files
      if (shouldExcludeFile(path)) {
        processedEntries++;
        continue;
      }

      // Extract filename from full path
      const filename = path.split("/").pop() || path;

      // Skip files that aren't in the whitelist
      if (!isAllowedFile(filename)) {
        processedEntries++;
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

      // Update progress
      processedEntries++;
      if (onProgress && totalEntries > 0) {
        const progress = Math.round((processedEntries / totalEntries) * 100);
        onProgress(progress);
      }
    }

    const result: ExtractionResult = {
      files: extractedFiles,
      totalFiles: extractedFiles.length,
      models: modelCount,
      images: imageCount,
    };

    // Log extraction time to console for performance monitoring
    const duration = Date.now() - startTime;
    console.log(`[Zip Extraction] Completed in ${duration}ms`, {
      filesFound: result.totalFiles,
      models: result.models,
      images: result.images,
      originalSize: zipFile.size,
    });

    return result;
  } catch (error) {
    // Log extraction failure
    const duration = Date.now() - startTime;
    console.error(`[Zip Extraction] Failed after ${duration}ms:`, error);

    throw error;
  }
}

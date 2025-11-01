/**
 * Pure file validation utilities (no server dependencies)
 * Can be safely imported in both server and test environments
 */

/**
 * Detect file extension, handling multi-dot extensions correctly
 * (e.g., .gcode.3mf, .tar.gz require checking full extension)
 *
 * @param filename - The filename to check
 * @param allowedExtensions - List of allowed extensions (order matters!)
 * @returns Matching extension or empty string
 *
 * @example
 * getFileExtension("test.gcode.3mf", [".gcode.3mf", ".gcode"]) // ".gcode.3mf"
 * getFileExtension("test.gcode", [".gcode.3mf", ".gcode"]) // ".gcode"
 */
export function getFileExtension(
  filename: string,
  allowedExtensions: string[],
): string {
  const lowerFilename = filename.toLowerCase();

  // Check extensions in order (critical for multi-dot extensions)
  for (const ext of allowedExtensions) {
    if (lowerFilename.endsWith(ext.toLowerCase())) {
      return ext;
    }
  }

  return "";
}

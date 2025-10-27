/**
 * Formats bytes into human-readable file size
 *
 * @param bytes - Number of bytes to format
 * @returns Formatted string (e.g., "1.5 MB", "500 KB")
 *
 * @example
 * formatBytes(1024) // "1 KB"
 * formatBytes(1536000) // "1.46 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

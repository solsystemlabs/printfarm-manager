interface ImportProgressProps {
  currentFileIndex: number;
  totalFiles: number;
  currentFileName: string;
  bytesUploaded?: number;
  totalBytes?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * ImportProgress Component
 *
 * Displays upload progress during bulk file import.
 *
 * Features:
 * - Percentage-based progress bar (AC#9, NFR-5)
 * - Current file being uploaded
 * - Files completed / total files
 * - Optional: total bytes uploaded / total bytes
 */
export function ImportProgress({
  currentFileIndex,
  totalFiles,
  currentFileName,
  bytesUploaded,
  totalBytes,
}: ImportProgressProps) {
  // Calculate percentage (0-100)
  const percentage =
    totalFiles > 0 ? Math.round((currentFileIndex / totalFiles) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Importing Files...
        </h3>
        <div className="text-sm font-medium text-gray-700">
          {currentFileIndex} / {totalFiles} files
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-700 mb-2">
          <span>Progress</span>
          <span className="font-semibold">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Current file */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-xs font-medium text-blue-900 mb-1">
          Currently uploading:
        </div>
        <div
          className="text-sm text-blue-800 font-medium truncate"
          title={currentFileName}
        >
          {currentFileName}
        </div>
      </div>

      {/* Optional: Bytes progress */}
      {bytesUploaded !== undefined && totalBytes !== undefined && (
        <div className="text-xs text-gray-600 text-center">
          {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)} uploaded
        </div>
      )}

      {/* Spinner animation */}
      <div className="flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    </div>
  );
}

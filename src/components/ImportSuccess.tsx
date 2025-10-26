interface ImportedFile {
  id: string;
  filename: string;
  r2Url: string;
  type: "model" | "image" | "unknown";
  size: number;
}

interface FailedFile {
  filename: string;
  error: string;
  message: string;
}

interface ImportSuccessProps {
  importedFiles: ImportedFile[];
  failedFiles: FailedFile[];
  totalBytes: number;
  onReset: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * ImportSuccess Component
 *
 * Displays success confirmation after bulk import completes.
 *
 * Features (AC#10):
 * - List of successfully imported files with thumbnails
 * - File counts and total size imported
 * - "Import Another Zip" button to reset flow
 * - Error summary if any files failed
 */
export function ImportSuccess({
  importedFiles,
  failedFiles,
  totalBytes,
  onReset,
}: ImportSuccessProps) {
  const successCount = importedFiles.length;
  const failureCount = failedFiles.length;

  return (
    <div className="space-y-6">
      {/* Success summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Import Complete!
            </h2>
            <p className="text-gray-700">
              Successfully imported{" "}
              <span className="font-semibold">{successCount}</span> file
              {successCount !== 1 ? "s" : ""} (
              <span className="font-semibold">{formatBytes(totalBytes)}</span>)
            </p>
            {failureCount > 0 && (
              <p className="text-red-600 mt-1">
                Failed to import{" "}
                <span className="font-semibold">{failureCount}</span> file
                {failureCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Error section (if any failures) */}
      {failedFiles.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4">
            Failed Imports ({failureCount})
          </h3>
          <div className="space-y-2">
            {failedFiles.map((file, index) => (
              <div
                key={index}
                className="bg-white border border-red-200 rounded p-3"
              >
                <div className="font-medium text-red-900">{file.filename}</div>
                <div className="text-sm text-red-700 mt-1">{file.message}</div>
                <div className="text-xs text-red-600 font-mono mt-1">
                  Error code: {file.error}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Successfully imported files grid */}
      {importedFiles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Successfully Imported ({successCount})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {importedFiles.map((file) => (
              <div
                key={file.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-200 rounded mb-3 flex items-center justify-center overflow-hidden">
                  {file.type === "image" ? (
                    // Show image thumbnail using R2 URL
                    <img
                      src={file.r2Url}
                      alt={file.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : file.type === "model" ? (
                    // Show 3D model placeholder
                    <div className="text-gray-400 text-center">
                      <svg
                        className="w-16 h-16 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                      <div className="text-xs font-medium mt-2">3D Model</div>
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      <svg
                        className="w-12 h-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="space-y-1">
                  <div
                    className="text-sm font-medium text-gray-900 truncate"
                    title={file.filename}
                  >
                    {file.filename}
                  </div>
                  <div className="text-xs text-gray-600">
                    {formatBytes(file.size)}
                  </div>
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                        file.type === "model"
                          ? "bg-green-100 text-green-800 border border-green-200"
                          : file.type === "image"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-gray-100 text-gray-800 border border-gray-200"
                      }`}
                    >
                      {file.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-center">
        <button
          onClick={onReset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          Import Another Zip
        </button>
      </div>
    </div>
  );
}

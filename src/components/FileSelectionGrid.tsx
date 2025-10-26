import { useState, useEffect } from "react";
import type { ExtractedFile } from "~/lib/zip/client-extractor";

interface FileSelectionGridProps {
  files: ExtractedFile[];
  onSelectionChange: (selectedFiles: ExtractedFile[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * FileSelectionGrid Component
 *
 * Displays extracted files in a responsive grid with thumbnail previews.
 * Allows users to select/deselect files before import.
 *
 * Features:
 * - Grid layout: 4 cols desktop → 2 tablet → 1 mobile (AC#1)
 * - Image thumbnails with actual preview (AC#2)
 * - 3D model placeholder icon (AC#3)
 * - Per-file checkboxes (AC#4)
 * - Bulk actions: Select All / Deselect All (AC#5)
 * - File metadata display: name, size, type (AC#6)
 * - Selection count summary
 */
export function FileSelectionGrid({
  files,
  onSelectionChange,
}: FileSelectionGridProps) {
  // Selection state: Map of file path → selected boolean
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => {
    // AC#4: All files selected by default
    return new Set(files.map((f) => f.path));
  });

  // Thumbnail URLs for image files (created from Blob)
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(
    new Map(),
  );

  // Create thumbnail URLs for image files on mount
  useEffect(() => {
    const urls = new Map<string, string>();

    files.forEach((file) => {
      if (file.type === "image") {
        // Create object URL for image preview
        const url = URL.createObjectURL(file.content);
        urls.set(file.path, url);
      }
    });

    setThumbnailUrls(urls);

    // Cleanup: revoke object URLs when component unmounts
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  // Notify parent when selection changes
  useEffect(() => {
    const selected = files.filter((file) => selectedPaths.has(file.path));
    onSelectionChange(selected);
  }, [selectedPaths, files, onSelectionChange]);

  // Toggle individual file selection
  const toggleFile = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Bulk action: Select all files
  const selectAll = () => {
    setSelectedPaths(new Set(files.map((f) => f.path)));
  };

  // Bulk action: Deselect all files
  const deselectAll = () => {
    setSelectedPaths(new Set());
  };

  const selectedCount = selectedPaths.size;
  const totalCount = files.length;

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-900">
          {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected /{" "}
          {totalCount} total
        </div>

        <div className="flex gap-2">
          <button
            onClick={selectAll}
            disabled={selectedCount === totalCount}
            className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed border border-blue-200 disabled:border-gray-200 rounded transition-colors"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            disabled={selectedCount === 0}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed border border-gray-200 rounded transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* File grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {files.map((file) => {
          const isSelected = selectedPaths.has(file.path);
          const thumbnailUrl = thumbnailUrls.get(file.path);

          return (
            <div
              key={file.path}
              onClick={() => toggleFile(file.path)}
              className={`
                relative bg-white border-2 rounded-lg p-3 cursor-pointer
                transition-all duration-200 hover:shadow-lg
                ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              {/* Checkbox */}
              <div className="absolute top-3 left-3 z-10">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleFile(file.path)}
                  onClick={(e) => e.stopPropagation()} // Prevent double-toggle
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
              </div>

              {/* Thumbnail or placeholder */}
              <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center overflow-hidden">
                {file.type === "image" && thumbnailUrl ? (
                  // AC#2: Show actual image preview
                  <img
                    src={thumbnailUrl}
                    alt={file.filename}
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-200"
                  />
                ) : file.type === "model" ? (
                  // AC#3: Show 3D model placeholder icon
                  <div className="text-gray-400 text-center">
                    <svg
                      className="w-20 h-20 mx-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {/* 3D cube icon */}
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
                  // Fallback for unknown types
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* File metadata (AC#6) */}
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
          );
        })}
      </div>

      {/* Empty state */}
      {files.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No files available for selection
        </div>
      )}
    </div>
  );
}

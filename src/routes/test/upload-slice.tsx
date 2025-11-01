import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { uploadSliceFile } from "~/lib/utils/upload";
import { formatBytes } from "~/lib/utils/format";

export const Route = createFileRoute("/test/upload-slice")({
  component: SliceUploadTester,
});

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = [".gcode.3mf", ".gcode"];

type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadedSlice {
  id: string;
  filename: string;
  r2Url: string;
  metadataExtracted: boolean;
  fileSize: number;
  createdAt: Date;
}

function SliceUploadTester() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedSlice, setUploadedSlice] = useState<UploadedSlice | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setUploadState("idle");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file");
      return;
    }

    setUploadState("uploading");
    setUploadProgress(0);
    setError(null);

    try {
      const result = await uploadSliceFile(selectedFile, {
        onProgress: (progress) => {
          setUploadProgress(progress.percentage);
        },
        onError: (err) => {
          console.error("Upload error:", err);
        },
      });

      setUploadedSlice(result);
      setUploadState("success");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during upload",
      );
      setUploadState("error");
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadState("idle");
    setUploadProgress(0);
    setUploadedSlice(null);
    setError(null);
  };

  const hasValidExtension = selectedFile
    ? ALLOWED_EXTENSIONS.some((ext) =>
        selectedFile.name.toLowerCase().endsWith(ext),
      )
    : false;
  const isFileTooLarge = selectedFile && selectedFile.size > MAX_FILE_SIZE;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Slice File Upload Tester
        </h1>
        <p className="text-gray-700">
          Upload .gcode or .gcode.3mf slice files to test the upload API
          endpoint.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
          <h3 className="text-red-800 font-semibold mb-2">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Upload State: Idle */}
      {uploadState === "idle" && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Upload Slice File
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Select Slice File (.gcode or .gcode.3mf)
            </label>
            <input
              type="file"
              accept=".gcode,.gcode.3mf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none px-3 py-2"
            />
          </div>

          {selectedFile && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">
                Selected File:
              </h3>
              <div className="text-sm text-gray-800 space-y-1">
                <p>
                  <span className="font-medium text-gray-900">Name:</span>{" "}
                  {selectedFile.name}
                </p>
                <p>
                  <span className="font-medium text-gray-900">Size:</span>{" "}
                  {formatBytes(selectedFile.size)}
                </p>
                <p>
                  <span className="font-medium text-gray-900">Type:</span>{" "}
                  {selectedFile.type || "application/octet-stream"}
                </p>
              </div>

              {!hasValidExtension && (
                <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                  ⚠️ File must have .gcode or .gcode.3mf extension
                </div>
              )}
              {isFileTooLarge && (
                <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                  ⚠️ File exceeds maximum size of {formatBytes(MAX_FILE_SIZE)}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={
              !selectedFile || !hasValidExtension || Boolean(isFileTooLarge)
            }
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Upload Slice File
          </button>
        </div>
      )}

      {/* Upload State: Uploading */}
      {uploadState === "uploading" && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Uploading...
          </h2>
          <div className="mb-4">
            <p className="text-sm text-gray-700 mb-2">
              Uploading {selectedFile?.name}
            </p>
            <div className="flex justify-between text-sm text-gray-700 mb-2">
              <span>Upload Progress</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upload State: Success */}
      {uploadState === "success" && uploadedSlice && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-green-600 mb-4">
            ✓ Upload Successful!
          </h2>

          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-semibold text-gray-900 mb-3">Slice Details:</h3>
            <div className="text-sm text-gray-800 space-y-2">
              <p>
                <span className="font-medium text-gray-900">ID:</span>{" "}
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  {uploadedSlice.id}
                </code>
              </p>
              <p>
                <span className="font-medium text-gray-900">Filename:</span>{" "}
                {uploadedSlice.filename}
              </p>
              <p>
                <span className="font-medium text-gray-900">File Size:</span>{" "}
                {formatBytes(uploadedSlice.fileSize)}
              </p>
              <p>
                <span className="font-medium text-gray-900">
                  Metadata Extracted:
                </span>{" "}
                <span
                  className={
                    uploadedSlice.metadataExtracted
                      ? "text-green-600"
                      : "text-orange-600"
                  }
                >
                  {uploadedSlice.metadataExtracted ? "Yes" : "No (Epic 3)"}
                </span>
              </p>
              <p>
                <span className="font-medium text-gray-900">Created At:</span>{" "}
                {new Date(uploadedSlice.createdAt).toLocaleString()}
              </p>
              <div className="mt-3">
                <span className="font-medium text-gray-900">R2 URL:</span>
                <div className="mt-1">
                  <a
                    href={uploadedSlice.r2Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-xs break-all"
                  >
                    {uploadedSlice.r2Url}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={resetUpload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Upload Another Slice
          </button>
        </div>
      )}

      {/* Upload State: Error */}
      {uploadState === "error" && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            Upload Failed
          </h2>
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={resetUpload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Info</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Accepted formats: .gcode, .gcode.3mf</li>
          <li>• Maximum file size: 50MB</li>
          <li>
            • Upload uses presigned URL pattern (bypasses Netlify 6MB limit)
          </li>
          <li>
            • Metadata extraction (Epic 3) is deferred - metadataExtracted will
            be false
          </li>
        </ul>
      </div>
    </div>
  );
}

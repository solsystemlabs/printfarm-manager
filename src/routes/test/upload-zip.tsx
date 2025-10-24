import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/test/upload-zip")({
  component: ZipUploadTester,
});

interface ExtractedFile {
  path: string;
  filename: string;
  type: "model" | "image" | "unknown";
  size: number;
}

interface UploadResponse {
  files: ExtractedFile[];
  totalFiles: number;
  models: number;
  images: number;
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function ZipUploadTester() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a zip file");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/models/upload-zip", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse;
        setError(`${errorData.message} (${response.status})`);
        return;
      }

      const data = (await response.json()) as UploadResponse;
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setUploading(false);
    }
  };

  const isFileTooLarge = selectedFile && selectedFile.size > MAX_FILE_SIZE;
  const isInvalidExtension =
    selectedFile && !selectedFile.name.toLowerCase().endsWith(".zip");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Zip Upload Endpoint Tester</h1>
        <p className="text-gray-600">
          Test the /api/models/upload-zip endpoint by uploading a zip file and
          viewing the extracted file metadata.
        </p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Zip File</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Zip File
          </label>
          <input
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            disabled={uploading}
          />
        </div>

        {selectedFile && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Selected File:</h3>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">Name:</span> {selectedFile.name}
              </p>
              <p>
                <span className="font-medium">Size:</span>{" "}
                {formatBytes(selectedFile.size)}
              </p>
              <p>
                <span className="font-medium">Type:</span> {selectedFile.type}
              </p>
            </div>

            {/* Validation Warnings */}
            {isFileTooLarge && (
              <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                ⚠️ File exceeds maximum size of{" "}
                {formatBytes(MAX_FILE_SIZE)} (will be rejected)
              </div>
            )}
            {isInvalidExtension && (
              <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded text-yellow-700 text-sm">
                ⚠️ File does not have .zip extension (will be rejected)
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {uploading ? "Extracting..." : "Upload & Extract"}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
          <h3 className="text-red-800 font-semibold mb-2">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Extraction Results</h2>

          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {result.totalFiles}
              </div>
              <div className="text-sm text-gray-600 mt-1">Total Files</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {result.models}
              </div>
              <div className="text-sm text-gray-600 mt-1">Models</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {result.images}
              </div>
              <div className="text-sm text-gray-600 mt-1">Images</div>
            </div>
          </div>

          {/* File List */}
          {result.files.length > 0 ? (
            <div>
              <h3 className="font-semibold mb-3">Extracted Files:</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold">
                        Path
                      </th>
                      <th className="text-left py-2 px-3 font-semibold">
                        Filename
                      </th>
                      <th className="text-left py-2 px-3 font-semibold">
                        Type
                      </th>
                      <th className="text-right py-2 px-3 font-semibold">
                        Size
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.files.map((file, index) => (
                      <tr
                        key={index}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-3 text-gray-600 font-mono text-xs">
                          {file.path}
                        </td>
                        <td className="py-2 px-3">{file.filename}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              file.type === "model"
                                ? "bg-green-100 text-green-800"
                                : file.type === "image"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {file.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">
                          {formatBytes(file.size)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No files found in the zip archive (or all files were filtered
              out).
            </div>
          )}
        </div>
      )}

      {/* API Information */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">API Endpoint Information</h3>
        <ul className="space-y-1 text-gray-600">
          <li>
            <span className="font-medium">Endpoint:</span> POST
            /api/models/upload-zip
          </li>
          <li>
            <span className="font-medium">Max Size:</span>{" "}
            {formatBytes(MAX_FILE_SIZE)}
          </li>
          <li>
            <span className="font-medium">Allowed Extensions:</span> .zip only
          </li>
          <li>
            <span className="font-medium">Supported File Types:</span> .stl,
            .3mf (models), .png, .jpg, .jpeg (images)
          </li>
          <li>
            <span className="font-medium">Note:</span> This endpoint only
            extracts and returns file metadata. It does NOT upload files to R2
            or create database records.
          </li>
        </ul>
      </div>
    </div>
  );
}

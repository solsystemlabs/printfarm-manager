import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  extractZipFile,
  type ExtractionResult,
} from "~/lib/zip/client-extractor";

export const Route = createFileRoute("/test/upload-zip")({
  component: ZipUploadTester,
});

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
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
      setProgress(0);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) {
      setError("Please select a zip file");
      return;
    }

    setExtracting(true);
    setError(null);
    setResult(null);
    setProgress(0);

    try {
      // Extract zip file CLIENT-SIDE (avoids Cloudflare Workers memory limits)
      const extractionResult = await extractZipFile(
        selectedFile,
        (progressPercent) => {
          setProgress(progressPercent);
        },
      );

      setResult(extractionResult);
      setProgress(100);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during extraction",
      );
    } finally {
      setExtracting(false);
    }
  };

  const isFileTooLarge = selectedFile && selectedFile.size > MAX_FILE_SIZE;
  const isInvalidExtension =
    selectedFile && !selectedFile.name.toLowerCase().endsWith(".zip");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Client-Side Zip Extraction Tester
        </h1>
        <p className="text-gray-700">
          Test client-side zip extraction by uploading a zip file and viewing
          the extracted file metadata. Extraction happens in your browser.
        </p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Upload Zip File
        </h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Select Zip File
          </label>
          <input
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none px-3 py-2"
            disabled={extracting}
          />
        </div>

        {selectedFile && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Selected File:</h3>
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
                {selectedFile.type}
              </p>
            </div>

            {/* Validation Warnings */}
            {isFileTooLarge && (
              <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                ⚠️ File exceeds maximum size of {formatBytes(MAX_FILE_SIZE)}{" "}
                (will be rejected)
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
          onClick={handleExtract}
          disabled={extracting || !selectedFile}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {extracting ? "Extracting..." : "Extract Zip File"}
        </button>

        {/* Progress Bar */}
        {extracting && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-700 mb-2">
              <span>Extraction Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
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
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Extraction Results
          </h2>

          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-3xl font-bold text-blue-700">
                {result.totalFiles}
              </div>
              <div className="text-sm text-gray-800 mt-1 font-medium">
                Total Files
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
              <div className="text-3xl font-bold text-green-700">
                {result.models}
              </div>
              <div className="text-sm text-gray-800 mt-1 font-medium">
                Models
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
              <div className="text-3xl font-bold text-purple-700">
                {result.images}
              </div>
              <div className="text-sm text-gray-800 mt-1 font-medium">
                Images
              </div>
            </div>
          </div>

          {/* File List */}
          {result.files.length > 0 ? (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Extracted Files:
              </h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">
                        Path
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">
                        Filename
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">
                        Type
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-900">
                        Size
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.files.map((file, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-700 font-mono text-xs">
                          {file.path}
                        </td>
                        <td className="py-3 px-4 text-gray-900">
                          {file.filename}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              file.type === "model"
                                ? "bg-green-200 text-green-900 border border-green-300"
                                : file.type === "image"
                                  ? "bg-purple-200 text-purple-900 border border-purple-300"
                                  : "bg-gray-200 text-gray-900 border border-gray-300"
                            }`}
                          >
                            {file.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-800 font-medium">
                          {formatBytes(file.size)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-700 font-medium">
              No files found in the zip archive (or all files were filtered
              out).
            </div>
          )}
        </div>
      )}

      {/* Extraction Information */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-2">
          Client-Side Extraction Information
        </h3>
        <ul className="space-y-1 text-gray-800">
          <li>
            <span className="font-medium text-gray-900">Processing:</span>{" "}
            Client-side (in your browser)
          </li>
          <li>
            <span className="font-medium text-gray-900">Max Size:</span>{" "}
            {formatBytes(MAX_FILE_SIZE)} (recommended)
          </li>
          <li>
            <span className="font-medium text-gray-900">
              Allowed Extensions:
            </span>{" "}
            .zip only
          </li>
          <li>
            <span className="font-medium text-gray-900">
              Supported File Types:
            </span>{" "}
            .stl, .3mf (models), .png, .jpg, .jpeg (images)
          </li>
          <li>
            <span className="font-medium text-gray-900">Note:</span> Extraction
            happens in your browser to avoid server memory limits. No files are
            uploaded to the server during extraction.
          </li>
        </ul>
      </div>
    </div>
  );
}

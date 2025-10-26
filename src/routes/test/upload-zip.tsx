import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { extractZipFile, type ExtractedFile } from "~/lib/zip/client-extractor";
import { FileSelectionGrid } from "~/components/FileSelectionGrid";
import { ImportProgress } from "~/components/ImportProgress";
import { ImportSuccess } from "~/components/ImportSuccess";

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

// Workflow states
type WorkflowState =
  | "upload" // Initial: upload zip file
  | "extracting" // Extracting zip file
  | "selecting" // Showing file selection grid
  | "importing" // Uploading selected files
  | "success"; // Import complete

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

function ZipUploadTester() {
  // Workflow state
  const [workflowState, setWorkflowState] = useState<WorkflowState>("upload");

  // Upload state
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);

  // Extraction state
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);

  // Selection state
  const [selectedFiles, setSelectedFiles] = useState<ExtractedFile[]>([]);

  // Import state
  const [importProgress, setImportProgress] = useState({
    currentIndex: 0,
    currentFileName: "",
    totalBytes: 0,
  });

  // Success state
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [failedFiles, setFailedFiles] = useState<FailedFile[]>([]);
  const [totalImportedBytes, setTotalImportedBytes] = useState(0);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Reset entire workflow
  const resetWorkflow = () => {
    setWorkflowState("upload");
    setSelectedZipFile(null);
    setExtractionProgress(0);
    setExtractedFiles([]);
    setSelectedFiles([]);
    setImportProgress({ currentIndex: 0, currentFileName: "", totalBytes: 0 });
    setImportedFiles([]);
    setFailedFiles([]);
    setTotalImportedBytes(0);
    setError(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedZipFile(file);
      setError(null);
    }
  };

  const handleExtract = async () => {
    if (!selectedZipFile) {
      setError("Please select a zip file");
      return;
    }

    setWorkflowState("extracting");
    setError(null);

    try {
      // Extract zip file CLIENT-SIDE (Story 2.3 pattern)
      const extractionResult = await extractZipFile(
        selectedZipFile,
        (progressPercent) => {
          setExtractionProgress(progressPercent);
        },
      );

      setExtractedFiles(extractionResult.files);
      setWorkflowState("selecting");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during extraction",
      );
      setWorkflowState("upload");
    }
  };

  const handleImportSelected = async () => {
    // Validation: At least one file selected
    if (selectedFiles.length === 0) {
      setError("Please select at least one file to import");
      return;
    }

    // Validation: Must have original zip file
    if (!selectedZipFile) {
      setError("Original zip file not found. Please start over.");
      return;
    }

    setWorkflowState("importing");
    setError(null);

    // Calculate total bytes for progress tracking
    const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    setImportProgress({
      currentIndex: 0,
      currentFileName: "",
      totalBytes,
    });

    try {
      // Prepare selected file paths for API
      const selectedPaths = selectedFiles.map((f) => f.path);

      // Create form data
      const formData = new FormData();
      formData.append("file", selectedZipFile);
      formData.append("selectedPaths", JSON.stringify(selectedPaths));

      // Call bulk import API with progress updates
      // Note: We can't get real-time progress from fetch, so we'll simulate it
      setImportProgress({
        currentIndex: 0,
        currentFileName: selectedFiles[0]?.filename || "",
        totalBytes,
      });

      const response = await fetch("/api/models/import-zip", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        imported: ImportedFile[];
        failed: FailedFile[];
        summary: { total: number; succeeded: number; failed: number; totalBytes: number };
        error?: { message: string };
      };

      if (!response.ok) {
        throw new Error(
          data.error?.message || "Failed to import files",
        );
      }

      // Success!
      setImportedFiles(data.imported);
      setFailedFiles(data.failed);
      setTotalImportedBytes(data.summary.totalBytes);
      setWorkflowState("success");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during import",
      );
      setWorkflowState("selecting");
    }
  };

  const isFileTooLarge =
    selectedZipFile && selectedZipFile.size > MAX_FILE_SIZE;
  const isInvalidExtension =
    selectedZipFile && !selectedZipFile.name.toLowerCase().endsWith(".zip");

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Bulk Model Import from Zip
        </h1>
        <p className="text-gray-700">
          Upload a zip file containing 3D models and images, select which files
          to import, and upload them to storage.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
          <h3 className="text-red-800 font-semibold mb-2">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Workflow State: Upload */}
      {workflowState === "upload" && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Step 1: Upload Zip File
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
            />
          </div>

          {selectedZipFile && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">
                Selected File:
              </h3>
              <div className="text-sm text-gray-800 space-y-1">
                <p>
                  <span className="font-medium text-gray-900">Name:</span>{" "}
                  {selectedZipFile.name}
                </p>
                <p>
                  <span className="font-medium text-gray-900">Size:</span>{" "}
                  {formatBytes(selectedZipFile.size)}
                </p>
              </div>

              {isFileTooLarge && (
                <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                  ⚠️ File exceeds maximum size of {formatBytes(MAX_FILE_SIZE)}
                </div>
              )}
              {isInvalidExtension && (
                <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded text-yellow-700 text-sm">
                  ⚠️ File does not have .zip extension
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleExtract}
            disabled={!selectedZipFile || Boolean(isFileTooLarge) || Boolean(isInvalidExtension)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Extract and Review Files
          </button>
        </div>
      )}

      {/* Workflow State: Extracting */}
      {workflowState === "extracting" && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Extracting Zip File...
          </h2>
          <div className="flex justify-between text-sm text-gray-700 mb-2">
            <span>Extraction Progress</span>
            <span>{extractionProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${extractionProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Workflow State: Selecting */}
      {workflowState === "selecting" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 2: Select Files to Import
            </h2>
            <p className="text-gray-700 mb-4">
              Review extracted files and select which ones to import. All files
              are selected by default.
            </p>
          </div>

          <FileSelectionGrid
            files={extractedFiles}
            onSelectionChange={setSelectedFiles}
          />

          <div className="flex gap-4">
            <button
              onClick={handleImportSelected}
              disabled={selectedFiles.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Import Selected Files ({selectedFiles.length})
            </button>
            <button
              onClick={resetWorkflow}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Workflow State: Importing */}
      {workflowState === "importing" && (
        <ImportProgress
          currentFileIndex={importProgress.currentIndex}
          totalFiles={selectedFiles.length}
          currentFileName={importProgress.currentFileName}
          bytesUploaded={importProgress.currentIndex * importProgress.totalBytes / selectedFiles.length}
          totalBytes={importProgress.totalBytes}
        />
      )}

      {/* Workflow State: Success */}
      {workflowState === "success" && (
        <ImportSuccess
          importedFiles={importedFiles}
          failedFiles={failedFiles}
          totalBytes={totalImportedBytes}
          onReset={resetWorkflow}
        />
      )}
    </div>
  );
}

/**
 * Upload utilities with progress tracking support
 */

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: Error) => void;
}

export interface ModelUploadResult {
  id: string;
  filename: string;
  r2Url: string;
  thumbnailUrl: string | null;
  fileSize: number;
  createdAt: Date;
}

/**
 * Upload form data with XMLHttpRequest to support progress tracking
 *
 * Unlike fetch(), XMLHttpRequest exposes upload.onprogress events,
 * enabling real-time progress tracking for large file uploads.
 *
 * @param url - API endpoint URL
 * @param formData - FormData containing files to upload
 * @param options - Upload options including progress callback
 * @returns Response data (parsed JSON)
 *
 * @example
 * await uploadWithProgress('/api/upload', formData, {
 *   onProgress: (progress) => {
 *     console.log(`${progress.percentage}% uploaded`);
 *   }
 * });
 */
export function uploadWithProgress<T = unknown>(
  url: string,
  formData: FormData,
  options: UploadOptions = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && options.onProgress) {
        const progress: UploadProgress = {
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        };
        options.onProgress(progress);
      }
    });

    // Handle completion
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as T;
          resolve(data);
        } catch (parseError) {
          reject(
            new Error(
              `Failed to parse response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            ),
          );
        }
      } else {
        // Extract error message from response if available
        try {
          const errorData = JSON.parse(xhr.responseText) as {
            error?: { message?: string };
          };
          const errorMessage =
            errorData.error?.message ||
            `Upload failed with status ${xhr.status}`;
          reject(new Error(errorMessage));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    // Handle network errors
    xhr.addEventListener("error", () => {
      const error = new Error("Network error during upload");
      if (options.onError) {
        options.onError(error);
      }
      reject(error);
    });

    // Handle abort
    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"));
    });

    // Send request
    xhr.open("POST", url);
    xhr.send(formData);
  });
}

/**
 * Upload model file using direct-to-R2 pattern with presigned URLs
 *
 * This 3-phase upload pattern bypasses Netlify's 6MB function payload limit:
 * 1. Get presigned URL from server
 * 2. Upload file directly to R2/MinIO
 * 3. Confirm upload and create database record
 *
 * @param file - File to upload
 * @param options - Upload options including progress callback
 * @returns Model record data
 *
 * @example
 * const model = await uploadModelFile(file, {
 *   onProgress: (progress) => {
 *     console.log(`${progress.percentage}% uploaded`);
 *   }
 * });
 */
export async function uploadModelFile(
  file: File,
  options: UploadOptions = {},
): Promise<ModelUploadResult> {
  try {
    // Phase 1: Get presigned URL
    const urlResponse = await fetch("/api/models/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
      }),
    });

    if (!urlResponse.ok) {
      const errorData = (await urlResponse.json()) as {
        error?: { message?: string };
      };
      throw new Error(
        errorData.error?.message ||
          `Failed to get upload URL: ${urlResponse.status}`,
      );
    }

    const { uploadUrl, storageKey } = (await urlResponse.json()) as {
      uploadUrl: string;
      storageKey: string;
      expiresAt: string;
    };

    // Phase 2: Upload directly to R2/MinIO with progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && options.onProgress) {
          const progress: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          };
          options.onProgress(progress);
        }
      });

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(
            new Error(
              `Direct upload failed with status ${xhr.status}: ${xhr.responseText}`,
            ),
          );
        }
      });

      // Handle network errors
      xhr.addEventListener("error", () => {
        const error = new Error(
          "Network error during direct upload to storage",
        );
        if (options.onError) {
          options.onError(error);
        }
        reject(error);
      });

      // Handle abort
      xhr.addEventListener("abort", () => {
        reject(new Error("Direct upload aborted"));
      });

      // Send request
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader(
        "Content-Type",
        file.type || "application/octet-stream",
      );
      xhr.send(file);
    });

    // Phase 3: Confirm upload and create database record
    const completeResponse = await fetch("/api/models/upload-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storageKey,
        filename: file.name,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream",
      }),
    });

    if (!completeResponse.ok) {
      const errorData = (await completeResponse.json()) as {
        error?: { message?: string };
      };
      throw new Error(
        errorData.error?.message ||
          `Failed to complete upload: ${completeResponse.status}`,
      );
    }

    return (await completeResponse.json()) as ModelUploadResult;
  } catch (error) {
    if (options.onError && error instanceof Error) {
      options.onError(error);
    }
    throw error;
  }
}

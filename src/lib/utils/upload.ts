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

// Storage client types and interfaces

/**
 * Unified storage client interface
 * Abstracts differences between MinIO (dev) and R2 (staging/prod)
 */
export interface StorageClient {
  put(
    key: string,
    content: string | Buffer,
    options?: UploadOptions,
  ): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  /**
   * Upload a file with metadata
   * Handles File objects with proper streaming and metadata
   */
  uploadFile(
    key: string,
    file: File,
    metadata: {
      contentType: string;
      contentDisposition: string;
    },
  ): Promise<void>;
  /**
   * Get public URL for a stored file
   */
  getPublicUrl(key: string): string;
  getEnvironment(): string;
  getStorageType(): "MinIO" | "Cloudflare R2";
}

/**
 * Upload options for storage operations
 */
export interface UploadOptions {
  contentType?: string;
  contentDisposition?: string;
}

declare global {
  // Augment NodeJS ProcessEnv with application environment variables
  // Using namespace is required for global type augmentation in Node.js
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      // Database configuration
      DATABASE_URL?: string;

      // Cloudflare R2 configuration (via AWS SDK)
      R2_ACCOUNT_ID?: string;
      R2_ACCESS_KEY_ID?: string;
      R2_SECRET_ACCESS_KEY?: string;
      R2_BUCKET_NAME?: string;
      R2_PUBLIC_URL?: string;

      // MinIO configuration (development)
      MINIO_ENDPOINT?: string;
      MINIO_PORT?: string;
      MINIO_USE_SSL?: string;
      MINIO_ACCESS_KEY?: string;
      MINIO_SECRET_KEY?: string;
      MINIO_BUCKET?: string;

      // Environment settings
      ENVIRONMENT?: string;
      XATA_BRANCH?: string;
    }
  }
}

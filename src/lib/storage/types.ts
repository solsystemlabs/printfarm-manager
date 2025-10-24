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

/**
 * Cloudflare environment bindings and variables
 * In Workers runtime, bindings are injected into process.env by TanStack Start adapter
 */
export type CloudflareEnv = {
  FILES_BUCKET?: R2Bucket;
  MINIO_ACCESS_KEY?: string;
  MINIO_SECRET_KEY?: string;
  MINIO_BUCKET?: string;
  ENVIRONMENT?: string;
  XATA_BRANCH?: string;
};

declare global {
  // Augment NodeJS ProcessEnv with Cloudflare environment variables
  // Using namespace is required for global type augmentation in Node.js
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      // Database configuration
      DATABASE_URL?: string;

      // Cloudflare R2 binding (injected by TanStack Start Cloudflare adapter)
      FILES_BUCKET?: R2Bucket;

      // R2 / MinIO configuration
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

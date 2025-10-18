// Storage client types and interfaces

/**
 * R2 bucket binding interface
 * Matches Cloudflare R2 API methods used in this application
 */
export interface R2Bucket {
  put(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: {
      httpMetadata?: {
        contentType?: string
        contentDisposition?: string
      }
    }
  ): Promise<void>
  get(key: string): Promise<{ text(): Promise<string> } | null>
  delete(key: string): Promise<void>
}

/**
 * Unified storage client interface
 * Abstracts differences between MinIO (dev) and R2 (staging/prod)
 */
export interface StorageClient {
  put(key: string, content: string | Buffer, options?: UploadOptions): Promise<void>
  get(key: string): Promise<string | null>
  delete(key: string): Promise<void>
  getEnvironment(): string
  getStorageType(): 'MinIO' | 'Cloudflare R2'
}

/**
 * Upload options for storage operations
 */
export interface UploadOptions {
  contentType?: string
  contentDisposition?: string
}

/**
 * Cloudflare environment bindings and variables
 * In Workers runtime, bindings are injected into process.env by TanStack Start adapter
 */
export type CloudflareEnv = {
  FILES_BUCKET?: R2Bucket
  MINIO_ACCESS_KEY?: string
  MINIO_SECRET_KEY?: string
  MINIO_BUCKET?: string
  ENVIRONMENT?: string
  XATA_BRANCH?: string
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends CloudflareEnv {}
  }
}

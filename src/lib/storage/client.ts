import type { StorageClient } from "./types";
import { R2StorageClient } from "./r2-client";

// Global constant replaced at build time by Vite
declare const __IS_CLOUDFLARE__: boolean;

/**
 * Storage client factory - returns environment-appropriate storage client
 * Follows the same pattern as src/lib/db.ts getPrismaClient()
 *
 * @returns StorageClient instance configured for current environment
 * @throws Error if required configuration is missing
 */
export async function getStorageClient(): Promise<StorageClient> {
  const environment = process.env.ENVIRONMENT || "development";

  // Use build-time constant for tree-shaking
  // When building for Cloudflare, the development branch will be removed entirely
  if (!__IS_CLOUDFLARE__ && environment === "development") {
    // Dynamically import MinIO client ONLY in development
    // This prevents the minio package from being bundled in production
    const { MinIOStorageClient } = await import("./minio-client");
    const { Client: MinioClient } = await import("minio");

    const accessKey = process.env.MINIO_ACCESS_KEY || "minioadmin";
    const secretKey = process.env.MINIO_SECRET_KEY || "minioadmin";
    const bucket = process.env.MINIO_BUCKET || "pm-dev-files";

    console.log(
      `[Storage] Initializing MinIO client for environment: ${environment}`,
    );
    console.log(
      `[Storage] MinIO config - bucket: ${bucket}, accessKey: ${accessKey}`,
    );

    const minioClient = new MinioClient({
      endPoint: "127.0.0.1",
      port: 9000,
      useSSL: false,
      accessKey,
      secretKey,
      region: "us-east-1", // Required to avoid auto-discovery signature issues
    });

    return new MinIOStorageClient(minioClient, bucket, environment);
  } else {
    // Use Cloudflare R2 for staging/production
    const bucket = process.env.FILES_BUCKET;

    if (!bucket) {
      throw new Error(
        `FILES_BUCKET binding not available in ${environment} environment - check wrangler.jsonc configuration`,
      );
    }

    console.log(
      `[Storage] Initializing R2 client for environment: ${environment}`,
    );
    console.log(`[Storage] R2 binding: FILES_BUCKET`);

    return new R2StorageClient(bucket, environment);
  }
}

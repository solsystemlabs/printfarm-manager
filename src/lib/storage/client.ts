import type { StorageClient, CloudflareEnv } from "./types";
import { R2StorageClient } from "./r2-client";

/**
 * Storage client factory - returns environment-appropriate storage client
 * Follows the same pattern as src/lib/db.ts getPrismaClient()
 *
 * @param cfEnv - Optional Cloudflare environment object containing bindings (for staging/production)
 * @returns StorageClient instance configured for current environment
 * @throws Error if required configuration is missing
 */
export async function getStorageClient(
  cfEnv?: CloudflareEnv,
): Promise<StorageClient> {
  const environment = process.env.ENVIRONMENT || "development";

  if (environment === "development") {
    // Development: Use MinIO with process.env configuration
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
    // Staging/Production: Use Cloudflare R2 via binding
    // The binding is accessed through Cloudflare context (getContext('cloudflare').env)
    const bucket = cfEnv?.FILES_BUCKET;

    if (!bucket) {
      throw new Error(
        `FILES_BUCKET binding not available in ${environment} environment. ` +
          `Ensure Cloudflare context is passed to getStorageClient(cfEnv). ` +
          `Check that R2 bucket is bound in Cloudflare dashboard and wrangler.jsonc is configured correctly.`,
      );
    }

    console.log(
      `[Storage] Initializing R2 client for environment: ${environment}`,
    );
    console.log(`[Storage] R2 binding: FILES_BUCKET`);

    return new R2StorageClient(bucket, environment);
  }
}

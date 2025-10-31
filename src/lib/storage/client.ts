import type { StorageClient } from "./types";
import { R2StorageClient } from "./r2-client";

/**
 * Storage client factory - returns environment-appropriate storage client
 *
 * Uses environment variables for configuration:
 * - Development: MinIO (local)
 * - Staging/Production: Cloudflare R2 (via AWS SDK)
 *
 * @returns StorageClient instance configured for current environment
 * @throws Error if required configuration is missing
 */
export async function getStorageClient(): Promise<StorageClient> {
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
    // Staging/Production: Use Cloudflare R2 via AWS SDK (S3-compatible API)
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error(
        `[Storage] Missing R2 configuration in ${environment} environment`,
      );
      console.error(`R2_ACCOUNT_ID: ${accountId ? "set" : "missing"}`);
      console.error(`R2_ACCESS_KEY_ID: ${accessKeyId ? "set" : "missing"}`);
      console.error(
        `R2_SECRET_ACCESS_KEY: ${secretAccessKey ? "set" : "missing"}`,
      );
      console.error(`R2_BUCKET_NAME: ${bucketName ? "set" : "missing"}`);

      throw new Error(
        `Missing required R2 configuration for ${environment} environment. ` +
          `Required environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME`,
      );
    }

    console.log(
      `[Storage] Initializing R2 client for environment: ${environment}`,
    );
    console.log(`[Storage] R2 bucket: ${bucketName}`);

    return new R2StorageClient({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      environment,
      publicUrl,
    });
  }
}

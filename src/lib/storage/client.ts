import type { Client as MinIOClient } from "minio";
import type { StorageClient, UploadOptions } from "./types";

/**
 * MinIO storage client implementation for local development
 */
class MinIOStorageClient implements StorageClient {
  private client: MinIOClient;
  private bucket: string;
  private environment: string;

  constructor(client: MinIOClient, bucket: string, environment: string) {
    this.client = client;
    this.bucket = bucket;
    this.environment = environment;
  }

  async put(
    key: string,
    content: string | Buffer,
    options?: UploadOptions,
  ): Promise<void> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const metadata: Record<string, string> = {};

    if (options?.contentType) {
      metadata["Content-Type"] = options.contentType;
    }

    console.log(`[MinIO] Uploading to bucket: ${this.bucket}, key: ${key}`);

    await this.client.putObject(
      this.bucket,
      key,
      buffer,
      buffer.length,
      metadata,
    );

    console.log(`[MinIO] Upload successful`);
  }

  async get(key: string): Promise<string | null> {
    try {
      console.log(
        `[MinIO] Downloading from bucket: ${this.bucket}, key: ${key}`,
      );

      const stream = await this.client.getObject(this.bucket, key);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => resolve());
        stream.on("error", (err: Error) => reject(err));
      });

      const content = Buffer.concat(chunks).toString("utf-8");

      console.log(`[MinIO] Download successful, size: ${content.length} bytes`);

      return content;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "NoSuchKey"
      ) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    console.log(`[MinIO] Deleting from bucket: ${this.bucket}, key: ${key}`);

    await this.client.removeObject(this.bucket, key);

    console.log(`[MinIO] Delete successful`);
  }

  getEnvironment(): string {
    return this.environment;
  }

  getStorageType(): "MinIO" | "Cloudflare R2" {
    return "MinIO";
  }
}

/**
 * R2 storage client implementation for staging/production
 */
class R2StorageClient implements StorageClient {
  private bucket: R2Bucket;
  private environment: string;

  constructor(bucket: R2Bucket, environment: string) {
    this.bucket = bucket;
    this.environment = environment;
  }

  async put(
    key: string,
    content: string | Buffer,
    options?: UploadOptions,
  ): Promise<void> {
    const contentStr = Buffer.isBuffer(content)
      ? content.toString("utf-8")
      : content;

    console.log(`[R2] Uploading key: ${key}`);

    await this.bucket.put(key, contentStr, {
      httpMetadata: {
        contentType: options?.contentType,
        contentDisposition: options?.contentDisposition,
      },
    });

    console.log(`[R2] Upload successful`);
  }

  async get(key: string): Promise<string | null> {
    console.log(`[R2] Downloading key: ${key}`);

    const object = await this.bucket.get(key);

    if (!object) {
      return null;
    }

    const content = await object.text();

    console.log(`[R2] Download successful, size: ${content.length} bytes`);

    return content;
  }

  async delete(key: string): Promise<void> {
    console.log(`[R2] Deleting key: ${key}`);

    await this.bucket.delete(key);

    console.log(`[R2] Delete successful`);
  }

  getEnvironment(): string {
    return this.environment;
  }

  getStorageType(): "MinIO" | "Cloudflare R2" {
    return "Cloudflare R2";
  }
}

/**
 * Storage client factory - returns environment-appropriate storage client
 * Follows the same pattern as src/lib/db.ts getPrismaClient()
 *
 * @returns StorageClient instance configured for current environment
 * @throws Error if required configuration is missing
 */
export async function getStorageClient(): Promise<StorageClient> {
  const environment = process.env.ENVIRONMENT || "development";

  if (environment === "development") {
    // Use MinIO for local development
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

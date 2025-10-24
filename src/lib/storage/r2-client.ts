import type { StorageClient, UploadOptions } from "./types";

/**
 * R2 storage client implementation for staging/production
 */
export class R2StorageClient implements StorageClient {
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

  async uploadFile(
    key: string,
    file: File,
    metadata: { contentType: string; contentDisposition: string },
  ): Promise<void> {
    console.log(`[R2] Uploading file key: ${key}, size: ${file.size} bytes`);

    // R2 can handle File streams directly
    await this.bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType: metadata.contentType,
        contentDisposition: metadata.contentDisposition,
      },
    });

    console.log(`[R2] File upload successful`);
  }

  getPublicUrl(key: string): string {
    // R2 public URL based on environment
    const bucketName =
      this.environment === "production" ? "pm-files" : "pm-staging-files";
    return `https://${bucketName}.r2.cloudflarestorage.com/${key}`;
  }

  getStorageType(): "MinIO" | "Cloudflare R2" {
    return "Cloudflare R2";
  }
}

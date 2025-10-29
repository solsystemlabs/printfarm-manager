import type { Client as MinIOClient } from "minio";
import type { StorageClient, UploadOptions } from "./types";

/**
 * MinIO storage client implementation for local development
 * This file is ONLY imported in development environment
 */
export class MinIOStorageClient implements StorageClient {
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

  async uploadFile(
    key: string,
    file: File,
    metadata: { contentType: string; contentDisposition: string },
  ): Promise<void> {
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const minioMetadata: Record<string, string> = {
      "Content-Type": metadata.contentType,
      "Content-Disposition": metadata.contentDisposition,
    };

    console.log(
      `[MinIO] Uploading file to bucket: ${this.bucket}, key: ${key}, size: ${buffer.length} bytes`,
    );

    await this.client.putObject(
      this.bucket,
      key,
      buffer,
      buffer.length,
      minioMetadata,
    );

    console.log(`[MinIO] File upload successful`);
  }

  getPublicUrl(key: string): string {
    // MinIO local development URL
    return `http://localhost:9000/${this.bucket}/${key}`;
  }

  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    console.log(`[MinIO] Generating presigned upload URL for key: ${key}`);

    const presignedUrl = await this.client.presignedPutObject(
      this.bucket,
      key,
      expiresIn,
    );

    console.log(`[MinIO] Presigned URL generated, expires in ${expiresIn} seconds`);

    return presignedUrl;
  }

  getStorageType(): "MinIO" | "Cloudflare R2" {
    return "MinIO";
  }
}

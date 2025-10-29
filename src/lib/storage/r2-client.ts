import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { StorageClient, UploadOptions } from "./types";

/**
 * R2 storage client implementation using AWS SDK (S3-compatible)
 * Works with Cloudflare R2 from any environment (Netlify, Node.js, etc.)
 */
export class R2StorageClient implements StorageClient {
  private s3Client: S3Client;
  private bucketName: string;
  private environment: string;
  private publicUrl: string;

  constructor(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    environment: string;
    publicUrl?: string;
  }) {
    // Create S3 client configured for Cloudflare R2
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.bucketName = config.bucketName;
    this.environment = config.environment;
    this.publicUrl = config.publicUrl || `https://${config.bucketName}.r2.cloudflarestorage.com`;
  }

  async put(
    key: string,
    content: string | Buffer,
    options?: UploadOptions,
  ): Promise<void> {
    const body = Buffer.isBuffer(content) ? content : Buffer.from(content);

    console.log(`[R2] Uploading key: ${key}`);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        ContentDisposition: options?.contentDisposition,
      })
    );

    console.log(`[R2] Upload successful`);
  }

  async get(key: string): Promise<string | null> {
    console.log(`[R2] Downloading key: ${key}`);

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      if (!response.Body) {
        return null;
      }

      const content = await response.Body.transformToString();

      console.log(`[R2] Download successful, size: ${content.length} bytes`);

      return content;
    } catch (error: any) {
      if (error.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    console.log(`[R2] Deleting key: ${key}`);

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
    );

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

    // Convert File to Buffer for S3 upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: metadata.contentType,
        ContentDisposition: metadata.contentDisposition,
      })
    );

    console.log(`[R2] File upload successful`);
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  getStorageType(): "MinIO" | "Cloudflare R2" {
    return "Cloudflare R2";
  }
}

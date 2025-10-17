import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

// Type definition for R2 bucket binding
interface R2Bucket {
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

// Extend process.env to include Cloudflare bindings
// In Workers runtime, bindings are injected into process.env by the adapter
type CloudflareEnv = {
  FILES_BUCKET?: R2Bucket
  MINIO_ACCESS_KEY?: string
  MINIO_SECRET_KEY?: string
  MINIO_BUCKET?: string
  ENVIRONMENT?: string
  XATA_BRANCH?: string
}

declare const process: {
  env: CloudflareEnv
}

export const Route = createFileRoute('/api/test-r2')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Environment variables work in both local dev (process.env) and Workers (injected by adapter)
          // In local dev: process.env from .dev.vars
          // In Workers: process.env is populated by the runtime from wrangler.jsonc vars and bindings
          const environment = process.env.ENVIRONMENT || 'development'

          let result: {
            success: boolean
            content?: string
            message: string
            environment: string
            storage: string
          }

          if (environment === 'development') {
            // Use MinIO JavaScript client for local development
            const { Client: MinioClient } = await import('minio')

            const accessKeyId = process.env.MINIO_ACCESS_KEY || 'minioadmin'
            const secretAccessKey = process.env.MINIO_SECRET_KEY || 'minioadmin'
            const bucket = process.env.MINIO_BUCKET || 'pm-dev-files'

            console.log('MinIO config:', { bucket, accessKeyId, environment })

            const minioClient = new MinioClient({
              endPoint: '127.0.0.1',
              port: 9000,
              useSSL: false,
              accessKey: accessKeyId,
              secretKey: secretAccessKey,
              region: 'us-east-1', // Required to avoid auto-discovery signature issues
            })

            const key = 'test/test.txt'
            const testContent = 'Hello from MinIO!'

            console.log('Attempting upload to:', bucket, key)

            // Test upload
            await minioClient.putObject(bucket, key, Buffer.from(testContent), testContent.length, {
              'Content-Type': 'text/plain',
            })

            console.log('Upload successful, attempting download')

            // Test download
            const stream = await minioClient.getObject(bucket, key)
            const chunks: Buffer[] = []

            await new Promise<void>((resolve, reject) => {
              stream.on('data', (chunk) => chunks.push(chunk))
              stream.on('end', () => resolve())
              stream.on('error', (err) => reject(err))
            })

            const content = Buffer.concat(chunks).toString('utf-8')

            console.log('Download successful, content:', content)

            // Test delete
            await minioClient.removeObject(bucket, key)

            console.log('Delete successful')

            result = {
              success: content === testContent,
              content: content || '',
              message: content === testContent ? 'MinIO read/write/delete successful' : 'Content mismatch',
              environment,
              storage: 'MinIO',
            }
          } else {
            // Use Cloudflare R2 for staging/production
            // R2 bucket binding injected by Cloudflare Workers runtime
            const bucket = process.env.FILES_BUCKET

            if (!bucket) {
              throw new Error('FILES_BUCKET binding not available - check wrangler.jsonc configuration')
            }

            const key = 'test/test.txt'
            const testContent = 'Hello from R2!'

            console.log('R2 config:', { environment, bucketBinding: 'FILES_BUCKET' })
            console.log('Attempting upload to R2:', key)

            // Test upload
            await bucket.put(key, testContent, {
              httpMetadata: {
                contentType: 'text/plain',
              },
            })

            console.log('Upload successful, attempting download')

            // Test download
            const object = await bucket.get(key)
            const content = await object?.text()

            console.log('Download successful, content:', content)

            // Test delete
            await bucket.delete(key)

            console.log('Delete successful')

            result = {
              success: content === testContent,
              content: content || '',
              message: content === testContent ? 'R2 read/write/delete successful' : 'Content mismatch',
              environment,
              storage: 'Cloudflare R2',
            }
          }

          return json(result)
        } catch (error) {
          console.error('R2/MinIO test error:', error)
          return json(
            {
              success: false,
              message: error instanceof Error ? error.message : 'Unknown error',
              environment: 'unknown',
              storage: 'unknown',
            },
            { status: 500 }
          )
        }
      },
    },
  },
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { StorageUsage, CloudflareConfig } from '~/lib/storage/usage'

// Create mock functions
const mockPrismaDisconnect = vi.fn()
const mockPoolEnd = vi.fn()
const mockGetPrismaClient = vi.fn(() => ({
  prisma: { $disconnect: mockPrismaDisconnect } as unknown as PrismaClient,
  pool: { end: mockPoolEnd } as unknown as { end: () => Promise<void> },
}))

const mockCalculateStorageUsage = vi.fn<[PrismaClient, CloudflareConfig?], Promise<StorageUsage>>()
const mockLog = vi.fn()

// Mock modules with hoisted mocks
vi.mock('../../../lib/db', () => ({
  getPrismaClient: mockGetPrismaClient,
}))

vi.mock('../../../lib/storage/usage', () => ({
  calculateStorageUsage: mockCalculateStorageUsage,
}))

vi.mock('../../../lib/utils/logger', () => ({
  log: mockLog,
}))

// Import the route after mocks are set up
const { Route } = await import('../../../routes/api/admin/storage')

describe('/api/admin/storage GET', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns storage usage when database is configured', async () => {
    // Setup environment
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test'

    // Mock storage calculation
    const mockUsage: StorageUsage = {
      totalBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      totalFiles: 150,
      breakdown: {
        models: { count: 100, bytes: 3 * 1024 * 1024 * 1024 },
        slices: { count: 50, bytes: 2 * 1024 * 1024 * 1024 },
        images: { count: 0, bytes: 0 },
      },
      percentOfLimit: 50,
      lastCalculated: new Date('2025-01-01T00:00:00Z'),
      source: 'hybrid' as const,
    }
    mockCalculateStorageUsage.mockResolvedValue(mockUsage)

    // Call handler
    const handler = Route.options.server!.handlers!.GET!
    const mockRequest = new Request('http://localhost/api/admin/storage')
    const response = await handler({ request: mockRequest } as { request: Request })

    // Verify response
    const data = await response.json()
    expect(data).toEqual({
      ...mockUsage,
      lastCalculated: mockUsage.lastCalculated.toISOString(), // Date is serialized to string
    })

    // Verify database client was created and cleaned up
    expect(mockGetPrismaClient).toHaveBeenCalledWith('postgresql://localhost:5432/test')
    expect(mockPrismaDisconnect).toHaveBeenCalled()
    expect(mockPoolEnd).toHaveBeenCalled()

    // Verify logging
    expect(mockLog).toHaveBeenCalledWith(
      'storage_calculated',
      expect.objectContaining({
        status: 200,
        totalBytes: mockUsage.totalBytes,
        totalFiles: mockUsage.totalFiles,
        source: 'hybrid',
      })
    )
  })

  it('uses R2 config when environment variables are set', async () => {
    // Setup environment with R2 config
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id'
    process.env.CLOUDFLARE_API_TOKEN = 'test-api-token'
    process.env.R2_BUCKET_NAME = 'my-custom-bucket'

    const mockUsage: StorageUsage = {
      totalBytes: 0,
      totalFiles: 0,
      breakdown: {
        models: { count: 0, bytes: 0 },
        slices: { count: 0, bytes: 0 },
        images: { count: 0, bytes: 0 },
      },
      percentOfLimit: 0,
      lastCalculated: new Date(),
      source: 'hybrid' as const,
    }
    mockCalculateStorageUsage.mockResolvedValue(mockUsage)

    const handler = Route.options.server!.handlers!.GET!
    const mockRequest = new Request('http://localhost/api/admin/storage')
    await handler({ request: mockRequest } as { request: Request })

    // Verify calculateStorageUsage was called with R2 config
    expect(mockCalculateStorageUsage).toHaveBeenCalledWith(expect.anything(), {
      accountId: 'test-account-id',
      apiToken: 'test-api-token',
      bucketName: 'my-custom-bucket',
    } as CloudflareConfig)
  })

  it('uses default bucket name when R2_BUCKET_NAME not set', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account'
    process.env.CLOUDFLARE_API_TOKEN = 'test-token'
    // R2_BUCKET_NAME not set

    const mockUsage: StorageUsage = {
      totalBytes: 0,
      totalFiles: 0,
      breakdown: {
        models: { count: 0, bytes: 0 },
        slices: { count: 0, bytes: 0 },
        images: { count: 0, bytes: 0 },
      },
      percentOfLimit: 0,
      lastCalculated: new Date(),
      source: 'database' as const,
    }
    mockCalculateStorageUsage.mockResolvedValue(mockUsage)

    const handler = Route.options.server!.handlers!.GET!
    const mockRequest = new Request('http://localhost/api/admin/storage')
    await handler({ request: mockRequest } as { request: Request })

    // Should use default bucket name
    expect(mockCalculateStorageUsage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bucketName: 'printfarm-files',
      }) as CloudflareConfig
    )
  })

  it('calls calculateStorageUsage without R2 config when credentials missing', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
    // No CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN

    const mockUsage: StorageUsage = {
      totalBytes: 1024 * 1024,
      totalFiles: 1,
      breakdown: {
        models: { count: 1, bytes: 1024 * 1024 },
        slices: { count: 0, bytes: 0 },
        images: { count: 0, bytes: 0 },
      },
      percentOfLimit: 0.01,
      lastCalculated: new Date(),
      source: 'database' as const,
    }
    mockCalculateStorageUsage.mockResolvedValue(mockUsage)

    const handler = Route.options.server!.handlers!.GET!
    const mockRequest = new Request('http://localhost/api/admin/storage')
    await handler({ request: mockRequest } as { request: Request })

    // Should be called without R2 config (second argument undefined)
    expect(mockCalculateStorageUsage).toHaveBeenCalledWith(expect.anything(), undefined)
  })

  it('returns 500 error when DATABASE_URL not configured', async () => {
    // No DATABASE_URL set
    delete process.env.DATABASE_URL

    const handler = Route.options.server!.handlers!.GET!
    const mockRequest = new Request('http://localhost/api/admin/storage')
    const response = await handler({ request: mockRequest } as { request: Request })

    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data).toEqual({
      error: 'Database not configured',
      message: 'DATABASE_URL environment variable is required',
    })

    // Should log error
    expect(mockLog).toHaveBeenCalledWith(
      'storage_api_error',
      expect.objectContaining({
        error: 'DATABASE_URL not configured',
        status: 500,
      })
    )

    // Should not attempt to create database client
    expect(mockGetPrismaClient).not.toHaveBeenCalled()
  })

  it('returns 500 error when storage calculation fails', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test'

    // Mock calculation error
    const error = new Error('Failed to query database')
    mockCalculateStorageUsage.mockRejectedValue(error)

    const handler = Route.options.server!.handlers!.GET!
    const mockRequest = new Request('http://localhost/api/admin/storage')
    const response = await handler({ request: mockRequest } as { request: Request })

    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data).toEqual({
      error: 'Failed to calculate storage usage',
      message: 'Failed to query database',
    })

    // Should still clean up connections
    expect(mockPrismaDisconnect).toHaveBeenCalled()
    expect(mockPoolEnd).toHaveBeenCalled()

    // Should log error
    expect(mockLog).toHaveBeenCalledWith(
      'storage_api_error',
      expect.objectContaining({
        error: 'Failed to query database',
        status: 500,
      })
    )
  })

  it('includes performance metrics in logs', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test'

    const mockUsage: StorageUsage = {
      totalBytes: 100,
      totalFiles: 1,
      breakdown: {
        models: { count: 1, bytes: 100 },
        slices: { count: 0, bytes: 0 },
        images: { count: 0, bytes: 0 },
      },
      percentOfLimit: 0.000001,
      lastCalculated: new Date(),
      source: 'database' as const,
    }
    mockCalculateStorageUsage.mockResolvedValue(mockUsage)

    const handler = Route.options.server!.handlers!.GET!
    const mockRequest = new Request('http://localhost/api/admin/storage')
    await handler({ request: mockRequest } as { request: Request })

    // Verify duration is logged
    expect(mockLog).toHaveBeenCalledWith(
      'storage_calculated',
      expect.objectContaining({
        durationMs: expect.any(Number),
      })
    )

    const logCall = mockLog.mock.calls[0][1]
    expect(logCall.durationMs).toBeGreaterThanOrEqual(0)
  })
})

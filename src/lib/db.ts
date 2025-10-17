import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Singleton pattern for Prisma Client to avoid memory leaks in Cloudflare Workers
// See: https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare

let prismaInstance: PrismaClient | null = null
let poolInstance: pg.Pool | null = null

export function getPrismaClient(): {
  prisma: PrismaClient
  pool: pg.Pool
} {
  if (!prismaInstance || !poolInstance) {
    // Create PostgreSQL connection pool
    poolInstance = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    })

    // Create Prisma adapter for edge runtime
    const adapter = new PrismaPg(poolInstance)

    // Initialize Prisma client with adapter
    prismaInstance = new PrismaClient({ adapter })
  }

  return {
    prisma: prismaInstance,
    pool: poolInstance,
  }
}

// Cleanup function for graceful shutdown
export async function closePrismaClient(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect()
    prismaInstance = null
  }
  if (poolInstance) {
    await poolInstance.end()
    poolInstance = null
  }
}
